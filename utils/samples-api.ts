/**
 * 샘플 관리 API 클라이언트 (로컬 Express + SQLite)
 *
 * @deprecated 샘플은 Supabase(autoflow_samples)를 사용합니다.
 * 프론트에서는 더 이상 사용하지 않으며, 서버 코드와 함께 레거시로만 유지됩니다.
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3002";

export interface Sample {
  id?: number;
  filename: string;
  name: string;
  input_data?: string;
  description?: string;
  category?: string;
  file_content?: any;
  created_at?: string;
  updated_at?: string;
}

export interface CreateSampleRequest {
  filename: string;
  name: string;
  input_data?: string;
  description?: string;
  category?: string;
  file_content: any;
}

export interface UpdateSampleRequest {
  name?: string;
  input_data?: string;
  description?: string;
  category?: string;
  file_content?: any;
}

export const samplesApi = {
  // 모든 샘플 조회
  async getAll(): Promise<Sample[]> {
    try {
      const response = await fetch(`${API_BASE}/api/samples`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Failed to fetch samples: ${response.status} ${response.statusText}`;

        // 404 에러인 경우 더 명확한 메시지
        if (response.status === 404) {
          errorMessage = `Failed to fetch samples: 404 Not Found - 서버가 실행 중이지 않거나 API 엔드포인트를 찾을 수 없습니다.`;
        }

        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error: any) {
      console.error("Error fetching samples:", error);
      // 네트워크 에러인 경우
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        throw new Error(
          "서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요."
        );
      }
      throw error;
    }
  },

  // 특정 샘플 조회
  async getById(id: number): Promise<Sample> {
    try {
      const response = await fetch(`${API_BASE}/api/samples/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Sample not found");
        }
        throw new Error(
          `Failed to fetch sample: ${response.status} ${response.statusText}`
        );
      }
      return await response.json();
    } catch (error: any) {
      console.error("Error fetching sample:", error);
      throw error;
    }
  },

  // 샘플 생성
  async create(
    sample: CreateSampleRequest
  ): Promise<{ id: number; message: string }> {
    try {
      const response = await fetch(`${API_BASE}/api/samples`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sample),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(
          errorData.error || `Failed to create sample: ${response.status}`
        );
      }

      return await response.json();
    } catch (error: any) {
      console.error("Error creating sample:", error);
      throw error;
    }
  },

  // 파일에서 가져오기
  async importFromFile(file: File): Promise<{ id: number; message: string }> {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE}/api/samples/import`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(
          errorData.error || `Failed to import sample: ${response.status}`
        );
      }

      return await response.json();
    } catch (error: any) {
      console.error("Error importing sample:", error);
      throw error;
    }
  },

  // 샘플 수정
  async update(
    id: number,
    sample: UpdateSampleRequest
  ): Promise<{ message: string }> {
    try {
      const url = `${API_BASE}/api/samples/${id}`;
      const body = JSON.stringify(sample);
      console.log("samplesApi.update - Request", { url, id, sample, body });

      const response = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: body,
      });

      console.log("samplesApi.update - Response", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("samplesApi.update - Error response", errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || "Unknown error" };
        }
        throw new Error(
          errorData.error || `Failed to update sample: ${response.status}`
        );
      }

      const result = await response.json();
      console.log("samplesApi.update - Success", result);
      return result;
    } catch (error: any) {
      console.error("Error updating sample:", error);
      throw error;
    }
  },

  // 샘플 삭제
  async delete(id: number): Promise<{ message: string }> {
    try {
      const response = await fetch(`${API_BASE}/api/samples/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(
          errorData.error || `Failed to delete sample: ${response.status}`
        );
      }

      return await response.json();
    } catch (error: any) {
      console.error("Error deleting sample:", error);
      throw error;
    }
  },
};
