/**
 * 포트 연결 사전 호환성 하이라이트 (순수 로직).
 *
 * 연결 드래그/탭 중, 캔버스의 각 포트가 "드롭 가능한 대상"인지 판정한다.
 * 연결은 출력→입력 방향만 유효하므로, 소스와 반대 방향이며 Port.type 이 같은 포트만 호환이다.
 */
export type PortHighlight = 'compatible' | 'incompatible' | null;

export interface ActiveSourcePort {
  moduleId: string;
  isInput: boolean;
  type: string;
}

/**
 *  - activeSource 없음 → null (하이라이트 없음)
 *  - 같은 모듈 → null (자기 자신에는 연결 불가)
 *  - 같은 방향(입력↔입력, 출력↔출력) → null (연결은 출력→입력만)
 *  - 반대 방향이며 타입 일치 → 'compatible' (초록 링)
 *  - 반대 방향이며 타입 불일치 → 'incompatible' (흐리게)
 */
export function getPortHighlight(
  activeSource: ActiveSourcePort | null,
  thisModuleId: string,
  portType: string,
  portIsInput: boolean,
): PortHighlight {
  if (!activeSource) return null;
  if (activeSource.moduleId === thisModuleId) return null;
  if (portIsInput === activeSource.isInput) return null;
  return portType === activeSource.type ? 'compatible' : 'incompatible';
}
