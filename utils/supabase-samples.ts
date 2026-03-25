/**
 * Supabase autoflow_samples 기반 샘플 API
 * - 목록: autoflow_samples + sample_models.name, sample_input_data.name 조인
 * - 단건: model.file_content 로드하여 실행
 */

import { supabase, isSupabaseConfigured } from "../lib/supabase";

export { isSupabaseConfigured };

export interface SampleModelRow {
  id: string;
  name: string;
  file_content: unknown;
  created_at?: string;
}

export interface SampleInputDataRow {
  id: string;
  name: string;
  content: string | null;
  created_at?: string;
}

export interface AutoflowSampleRow {
  id: string;
  app_section: string;
  category: string | null;
  developer_email: string | null;
  model_id: string;
  input_data_id: string | null;
  description: string | null;
  created_at?: string;
  updated_at?: string;
}

/** 목록용: autoflow_samples + 모델명, 입력데이터명 */
export interface AutoflowSampleListItem {
  id: string;
  model_id?: string;
  app_section: string;
  category: string | null;
  developer_email: string | null;
  model_name: string;
  input_data_name: string | null;
  description: string | null;
  created_at?: string;
  updated_at?: string;
}

/** 앱에서 쓰는 샘플 한 건 (모델 실행용 file_content 포함) */
export interface AutoflowSampleWithContent {
  id: string;
  app_section: string;
  category: string | null;
  developer_email: string | null;
  model_name: string;
  input_data_id: string | null;
  input_data_name: string | null;
  description: string | null;
  file_content: { modules: unknown[]; connections: unknown[] };
  input_data_content: string | null;
}

/** 목록 조회 (LIFE 앱 전용: app_section = "LIFE"만) */
export async function fetchAutoflowSamplesList(): Promise<AutoflowSampleListItem[]> {
  if (!isSupabaseConfigured()) return [];

  const { data: rows, error } = await supabase
    .from("autoflow_samples")
    .select(
      `
      id,
      model_id,
      app_section,
      category,
      developer_email,
      description,
      created_at,
      updated_at,
      sample_models!inner ( name ),
      sample_input_data ( name )
    `
    )
    .eq("app_section", "LIFE")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Supabase] fetchAutoflowSamplesList error:", error.code, error.message, error.details);
    return [];
  }

  return (rows || []).map((r: any) => ({
    id: r.id,
    model_id: r.model_id,
    app_section: r.app_section ?? "LIFE",
    category: r.category,
    developer_email: r.developer_email,
    description: r.description,
    created_at: r.created_at,
    updated_at: r.updated_at,
    model_name: r.sample_models?.name ?? "",
    input_data_name: r.sample_input_data?.name ?? null,
  }));
}

/** 단건 조회 (실행용: file_content + 입력데이터 내용) */
export async function fetchAutoflowSampleById(
  id: string
): Promise<AutoflowSampleWithContent | null> {
  if (!isSupabaseConfigured()) return null;

  const { data: sample, error: sampleError } = await supabase
    .from("autoflow_samples")
    .select(
      `
      id,
      app_section,
      category,
      developer_email,
      description,
      model_id,
      input_data_id,
      sample_models!inner ( name, file_content ),
      sample_input_data ( name, content )
    `
    )
    .eq("id", id)
    .single();

  if (sampleError || !sample) {
    console.error("[Supabase] fetchAutoflowSampleById error:", sampleError);
    return null;
  }

  const model = (sample as any).sample_models;
  const inputData = (sample as any).sample_input_data;

  const fileContent = model?.file_content;
  const modules = Array.isArray(fileContent?.modules) ? fileContent.modules : [];
  const connections = Array.isArray(fileContent?.connections) ? fileContent.connections : [];

  return {
    id: sample.id,
    app_section: sample.app_section ?? "LIFE",
    category: sample.category,
    developer_email: sample.developer_email,
    model_name: model?.name ?? "",
    input_data_id: (sample as any).input_data_id ?? null,
    input_data_name: inputData?.name ?? null,
    description: sample.description,
    file_content: { modules, connections },
    input_data_content: inputData?.content ?? null,
  };
}

/** 모델 생성 (sample_models) */
export async function createSampleModel(
  name: string,
  file_content: { modules: unknown[]; connections: unknown[] }
): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured()) {
    console.error("[Supabase] createSampleModel: Supabase가 설정되지 않았습니다.");
    return null;
  }

  const { data, error } = await supabase
    .from("sample_models")
    .insert({ name, file_content })
    .select("id")
    .single();

  if (error) {
    console.error("[Supabase] createSampleModel error:", error.code, error.message, error.details);
    throw new Error(`Supabase 오류 (${error.code}): ${error.message}`);
  }
  return data ? { id: data.id } : null;
}

/** 입력 데이터 생성 (sample_input_data) */
export async function createSampleInputData(
  name: string,
  content: string
): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from("sample_input_data")
    .insert({ name, content })
    .select("id")
    .single();

  if (error) {
    console.error("[Supabase] createSampleInputData error:", error);
    return null;
  }
  return data ? { id: data.id } : null;
}

/** autoflow_samples 행 생성 */
export async function createAutoflowSample(params: {
  app_section?: string;
  category?: string;
  developer_email?: string;
  model_id: string;
  input_data_id?: string | null;
  description?: string;
}): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from("autoflow_samples")
    .insert({
      app_section: params.app_section ?? "LIFE",
      category: params.category ?? null,
      developer_email: params.developer_email ?? null,
      model_id: params.model_id,
      input_data_id: params.input_data_id ?? null,
      description: params.description ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[Supabase] createAutoflowSample error:", error);
    return null;
  }
  return data ? { id: data.id } : null;
}

/** 샘플 수정 (autoflow_samples + 필요 시 model/input_data) */
export async function updateAutoflowSample(
  id: string,
  updates: {
    app_section?: string;
    category?: string;
    developer_email?: string;
    description?: string;
    model_id?: string;
    input_data_id?: string | null;
  }
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from("autoflow_samples")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("[Supabase] updateAutoflowSample error:", error);
    return false;
  }
  return true;
}

/** 모델 이름 수정 (sample_models.name) */
export async function updateSampleModel(
  modelId: string,
  updates: { name?: string }
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  if (!updates.name?.trim()) return true;
  const { error } = await supabase
    .from("sample_models")
    .update({ name: updates.name.trim() })
    .eq("id", modelId);
  if (error) {
    console.error("[Supabase] updateSampleModel error:", error);
    return false;
  }
  return true;
}

/** 모델 file_content 수정 */
export async function updateSampleModelContent(
  modelId: string,
  file_content: { modules: unknown[]; connections: unknown[] }
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from("sample_models")
    .update({ file_content })
    .eq("id", modelId);

  if (error) {
    console.error("[Supabase] updateSampleModelContent error:", error);
    return false;
  }
  return true;
}

/** 입력 데이터 레코드 삭제 (sample_input_data) */
export async function deleteSampleInputData(inputDataId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from("sample_input_data")
    .delete()
    .eq("id", inputDataId);

  if (error) {
    console.error("[Supabase] deleteSampleInputData error:", error);
    return false;
  }
  return true;
}

/** 샘플 삭제 (autoflow_samples만 삭제하면 FK로 모델/입력데이터는 유지; 또는 CASCADE로 모델도 삭제) */
export async function deleteAutoflowSample(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase.from("autoflow_samples").delete().eq("id", id);

  if (error) {
    console.error("[Supabase] deleteAutoflowSample error:", error);
    return false;
  }
  return true;
}
