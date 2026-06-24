/**
 * 데이터셋 레지스트리 (하이브리드) — Azure ML "등록된 데이터 자산" 방식 미러.
 *
 * 샘플/저장 모델의 LoadData 모듈은 데이터 본문 대신 파일명(source)만 가질 수 있다.
 * 이 모듈은 파일명을 실제 CSV 본문으로 "해석(resolve)"한다. 해석 우선순위:
 *   1) 인메모리 파일 캐시(같은 세션에서 이미 로드한 파일)
 *   2) 번들 레지스트리: public/examples-in-load.json (오프라인 OK, 없으면 빈 맵)
 *   3) 웹 폴백: Supabase Storage 공개 버킷 'datasets' (큰/커스텀 데이터)
 * 어느 경로로 해석하든 결과는 파일 캐시에 적재되어 이후 조회는 즉시 반환된다.
 *
 * 설계 원칙: 가산적·하위호환. 실행 경로/내보낸 코드/샘플 동작 불변.
 * 입력층(LoadData.parameters.fileContent)만 채운다 — 이미 본문이 있는 샘플은
 * 절대 건드리지 않는다(이 앱 샘플은 fileContent 동봉이 기본이라 무영향).
 *
 * 적응 포팅 메모(life matrix flow): 이 앱에는 별도 fileContentCache 모듈이 없어
 * 본 파일에 간단한 모듈 레벨 캐시를 인라인했다. examples-in-load.json 도 없어
 * 번들 레지스트리는 조용히 빈 맵을 반환하고 Supabase 폴백만 동작한다.
 */

/** 세션 내 파일명→본문 캐시(모듈 레벨, 인라인). */
const fileContentCache = new Map<string, string>();

function cacheFileContent(name: string, content: string): void {
  const key = String(name || "").trim();
  if (key) fileContentCache.set(key, content);
}

function getCachedFileContent(name: string): string | undefined {
  return fileContentCache.get(String(name || "").trim());
}

/** 웹 폴백에 사용할 Supabase Storage 버킷 이름. 없으면 폴백은 조용히 건너뛴다. */
const DATASET_BUCKET = "datasets";

/**
 * 모델 저장 시 데이터 본문을 localStorage에 직접 임베드해도 안전한 상한(MB).
 * localStorage 쿼터(~5MB)는 모든 저장 모델이 공유하므로 보수적으로 둔다.
 * 이 값을 넘는 데이터는 임베드 대신 웹 예제(Supabase 'datasets')로 등록해
 * 이름(참조)으로 저장하도록 유도한다.
 */
export const EMBED_SIZE_LIMIT_MB = 2;

/** 문자열(CSV 본문)의 바이트 크기를 MB로 환산. */
export function contentSizeMB(content: string): number {
  if (!content) return 0;
  return new Blob([content]).size / (1024 * 1024);
}

export interface DatasetUploadResult {
  ok: boolean;
  error?: string;
}

/**
 * 데이터를 Supabase Storage 'datasets' 버킷에 업로드해 "웹 예제"로 등록한다.
 * 성공 시 어느 앱에서나 resolveDatasetContent(파일명)로 가져올 수 있고,
 * 세션 캐시에도 즉시 적재한다. Supabase 미구성이면 ok:false를 반환(가산적·안전).
 *
 * 적응 포팅 메모(life matrix flow): cacheFileContent 는 이 파일 상단의 인라인
 * 캐시 함수를 그대로 사용한다(별도 fileContentCache 모듈 없음).
 */
export async function uploadDatasetToWeb(
  filename: string,
  content: string
): Promise<DatasetUploadResult> {
  const name = String(filename || "").trim();
  if (!name || !content) return { ok: false, error: "파일명 또는 데이터가 비었습니다." };
  try {
    const mod: any = await import("../lib/supabase").catch(() => null);
    const supabase = mod?.supabase;
    const isConfigured = mod?.isSupabaseConfigured;
    if (!supabase || (typeof isConfigured === "function" && !isConfigured())) {
      return { ok: false, error: "Supabase Storage가 설정되지 않았습니다(.env 확인)." };
    }
    const blob = new Blob([content], { type: "text/csv" });
    const { error } = await supabase.storage
      .from(DATASET_BUCKET)
      .upload(name, blob, { upsert: true, contentType: "text/csv" });
    if (error) return { ok: false, error: error.message || String(error) };
    cacheFileContent(name, content); // 즉시 사용 가능하도록 세션 캐시 적재(인라인)
    // 번들 레지스트리 메모이즈 맵에도 반영(이번 세션 내 즉시 해석)
    if (bundledRegistry) bundledRegistry.set(normalizeName(name), content);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/** 번들 레지스트리 1회 로드 후 메모이즈 (filename(소문자) → CSV 본문). */
let bundledRegistry: Map<string, string> | null = null;
let bundledRegistryPromise: Promise<Map<string, string>> | null = null;

function normalizeName(name: string): string {
  return String(name || "").trim().toLowerCase();
}

/** public/examples-in-load.json 을 1회 fetch 해 파일명→본문 맵으로 만든다. */
async function loadBundledRegistry(): Promise<Map<string, string>> {
  if (bundledRegistry) return bundledRegistry;
  if (bundledRegistryPromise) return bundledRegistryPromise;

  bundledRegistryPromise = (async () => {
    const map = new Map<string, string>();
    try {
      const res = await fetch("/examples-in-load.json", { cache: "no-cache" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          for (const entry of data) {
            const key = normalizeName(entry?.name || entry?.filename);
            const content = entry?.content;
            if (key && typeof content === "string") map.set(key, content);
          }
        }
      }
    } catch {
      /* 번들 레지스트리가 없는 앱에서는 조용히 빈 맵 */
    }
    bundledRegistry = map;
    return map;
  })();

  return bundledRegistryPromise;
}

/** Supabase Storage 'datasets' 버킷에서 파일을 받아 본문을 반환(미구성/실패 시 null). */
async function fetchFromSupabaseStorage(filename: string): Promise<string | null> {
  try {
    // 동적 import — Supabase 클라이언트가 없는 빌드/실행에서도 안전.
    const mod: any = await import("../lib/supabase").catch(() => null);
    const supabase = mod?.supabase;
    const isConfigured = mod?.isSupabaseConfigured;
    if (!supabase || (typeof isConfigured === "function" && !isConfigured())) {
      return null;
    }
    const { data, error } = await supabase.storage
      .from(DATASET_BUCKET)
      .download(filename);
    if (error || !data) return null;
    const text = await data.text();
    return text && text.trim() ? text : null;
  } catch {
    return null;
  }
}

/**
 * 파일명을 실제 CSV 본문으로 해석한다. 캐시→번들→웹 순서. 없으면 null.
 * 성공 시 파일 캐시에 적재한다.
 */
export async function resolveDatasetContent(
  filename: string
): Promise<string | null> {
  const raw = String(filename || "").trim();
  if (!raw) return null;

  // 1) 인메모리 파일 캐시 (정확 일치)
  const cached = getCachedFileContent(raw);
  if (cached) return cached;

  const key = normalizeName(raw);

  // 2) 번들 레지스트리 (대소문자 무시)
  const registry = await loadBundledRegistry();
  const bundled = registry.get(key);
  if (bundled) {
    cacheFileContent(raw, bundled);
    return bundled;
  }

  // 3) 웹 폴백 (Supabase Storage)
  const web = await fetchFromSupabaseStorage(raw);
  if (web) {
    cacheFileContent(raw, web);
    return web;
  }

  return null;
}

/** 번들 레지스트리에서 사용 가능한 데이터셋 파일명 목록(소문자 키). */
export async function listBundledDatasets(): Promise<string[]> {
  const registry = await loadBundledRegistry();
  return Array.from(registry.keys());
}

/** 데이터 로더로 취급할 모듈 타입(이 앱은 LoadData 1종). */
const LOADER_TYPES = new Set(["LoadData"]);

/** 모듈이 데이터 로더이며 본문 주입이 필요한지 판정. */
function needsDatasetBinding(module: any): boolean {
  if (!module || !LOADER_TYPES.has(module.type)) return false;
  const p = module.parameters || {};
  // 이미 본문이 있으면 건드리지 않는다(사용자 업로드/동봉 데이터 보존).
  if (p.fileContent && String(p.fileContent).trim()) return false;
  // URL 소스는 별도 로더가 처리(여기서 덮어쓰지 않음).
  if (p.sourceType === "url") return false;
  // 해석할 파일명이 있어야 한다.
  return Boolean(String(p.source || "").trim());
}

export interface DatasetBindingResult {
  /** 본문이 주입된(=실행 가능해진) 로더 모듈 이름들 */
  bound: string[];
  /** 파일명을 가졌지만 어디서도 데이터를 못 찾은 로더 모듈들 */
  missing: { name: string; source: string }[];
}

/**
 * 모듈 배열을 순회하며 데이터 로더에 본문을 자동 주입한다(제자리 변형).
 * 샘플/저장 모델 로드 직후 호출 → 데이터 본문 없이도 즉시 실행 가능.
 * 못 찾은 항목은 하드에러 없이 missing 으로 보고(사용자가 직접 Browse 가능).
 */
export async function bindDatasetsToModules(
  modules: any[]
): Promise<DatasetBindingResult> {
  const result: DatasetBindingResult = { bound: [], missing: [] };
  if (!Array.isArray(modules)) return result;

  for (const module of modules) {
    if (!needsDatasetBinding(module)) continue;
    const source = String(module.parameters.source || "").trim();
    const content = await resolveDatasetContent(source);
    if (content) {
      const isExcel = /\.xlsx?$/i.test(source);
      module.parameters.fileContent = content;
      module.parameters.fileType = isExcel ? "excel" : "csv";
      module.parameters.sourceType = "file";
      result.bound.push(module.name || module.type);
    } else {
      result.missing.push({ name: module.name || module.type, source });
    }
  }

  return result;
}
