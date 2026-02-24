/**
 * Whole Life 모델 + Risk_Rates_Whole CSV를 Supabase에 등록하는 스크립트
 *
 * 사용법:
 *   node scripts/seed-whole-life-to-supabase.mjs [모델파일경로] [데이터파일경로]
 *
 * 예:
 *   node scripts/seed-whole-life-to-supabase.mjs "C:\\Users\\tklee\\Downloads\\Whole Life.lifx" "C:\\Users\\tklee\\Downloads\\Risk_Rates_Whole.csv"
 *
 * .env에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY 가 있어야 합니다.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// .env 로드 (간단 파싱)
function loadEnv() {
  const envPath = resolve(projectRoot, ".env");
  if (!existsSync(envPath)) {
    console.error(".env 파일을 찾을 수 없습니다.");
    process.exit(1);
  }
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eq = trimmed.indexOf("=");
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        process.env[key] = value;
      }
    }
  }
}

loadEnv();

const supabaseUrl =
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Supabase URL/Key가 없습니다. .env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 또는 NEXT_PUBLIC_SUPABASE_* 를 설정하세요."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const modelPath = process.argv[2] || resolve(projectRoot, "Whole Life.lifx");
const dataPath = process.argv[3] || resolve(projectRoot, "Risk_Rates_Whole.csv");

async function main() {
  console.log("모델 파일:", modelPath);
  console.log("데이터 파일:", dataPath);

  if (!existsSync(modelPath)) {
    console.error("모델 파일을 찾을 수 없습니다:", modelPath);
    process.exit(1);
  }
  if (!existsSync(dataPath)) {
    console.error("데이터 파일을 찾을 수 없습니다:", dataPath);
    process.exit(1);
  }

  const modelRaw = readFileSync(modelPath, "utf-8");
  const dataRaw = readFileSync(dataPath, "utf-8");

  let modelJson;
  try {
    modelJson = JSON.parse(modelRaw);
  } catch (e) {
    console.error("모델 파일 JSON 파싱 실패:", e.message);
    process.exit(1);
  }

  const modules = Array.isArray(modelJson.modules) ? modelJson.modules : [];
  const connections = Array.isArray(modelJson.connections) ? modelJson.connections : [];

  // 1) 입력 데이터 등록
  console.log("입력 데이터 등록 중...");
  const { data: inputRow, error: inputError } = await supabase
    .from("sample_input_data")
    .insert({ name: "Risk_Rates_Whole", content: dataRaw })
    .select("id")
    .single();

  if (inputError) {
    console.error("sample_input_data 삽입 실패:", inputError.message);
    process.exit(1);
  }
  console.log("  -> sample_input_data id:", inputRow.id);

  // 2) 모델 등록
  console.log("모델 등록 중...");
  const { data: modelRow, error: modelError } = await supabase
    .from("sample_models")
    .insert({ name: "Whole Life", file_content: { modules, connections } })
    .select("id")
    .single();

  if (modelError) {
    console.error("sample_models 삽입 실패:", modelError.message);
    process.exit(1);
  }
  console.log("  -> sample_models id:", modelRow.id);

  // 3) autoflow_samples 등록 (종신보험)
  console.log("샘플 등록 중 (종신보험)...");
  const { data: sampleRow, error: sampleError } = await supabase
    .from("autoflow_samples")
    .insert({
      app_section: "Life",
      category: "종신보험",
      developer_email: null,
      model_id: modelRow.id,
      input_data_id: inputRow.id,
      description: "종신보험 프라이싱 모델 (Whole Life)",
    })
    .select("id")
    .single();

  if (sampleError) {
    console.error("autoflow_samples 삽입 실패:", sampleError.message);
    process.exit(1);
  }
  console.log("  -> autoflow_samples id:", sampleRow.id);

  console.log("\n완료. Samples 화면에서 'Whole Life'를 확인하세요.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
