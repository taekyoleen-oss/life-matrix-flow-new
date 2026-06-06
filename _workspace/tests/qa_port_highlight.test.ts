/**
 * 비호환 포트 연결 사전 하이라이트 (순수 로직) 검증.
 * getPortHighlight: 연결 드래그/탭 중 각 포트가 드롭 가능 대상인지 판정.
 */
import { describe, it, expect } from 'vitest';
import { getPortHighlight, ActiveSourcePort } from '../../utils/portHighlight';

const outSource: ActiveSourcePort = { moduleId: 'A', isInput: false, type: 'data' };
const inSource: ActiveSourcePort = { moduleId: 'A', isInput: true, type: 'premium' };

describe('getPortHighlight — 포트 연결 사전 호환성', () => {
  it('활성 소스 없음 → null', () => {
    expect(getPortHighlight(null, 'B', 'data', true)).toBeNull();
  });

  it('같은 모듈의 포트 → null (자기 자신 연결 불가)', () => {
    expect(getPortHighlight(outSource, 'A', 'data', true)).toBeNull();
  });

  it('같은 방향(출력 소스 ↔ 출력 포트) → null', () => {
    expect(getPortHighlight(outSource, 'B', 'data', false)).toBeNull();
  });

  it('출력 소스 → 타입 같은 입력 포트 = compatible (초록)', () => {
    expect(getPortHighlight(outSource, 'B', 'data', true)).toBe('compatible');
  });

  it('출력 소스 → 타입 다른 입력 포트 = incompatible (흐리게)', () => {
    expect(getPortHighlight(outSource, 'B', 'premium', true)).toBe('incompatible');
  });

  it('입력 포트에서 시작한 드래그(소스=입력) → 타입 같은 출력 포트 = compatible', () => {
    expect(getPortHighlight(inSource, 'B', 'premium', false)).toBe('compatible');
  });

  it('입력 소스 → 타입 다른 출력 포트 = incompatible', () => {
    expect(getPortHighlight(inSource, 'B', 'data', false)).toBe('incompatible');
  });

  it('입력 소스 ↔ 입력 포트(같은 방향) → null', () => {
    expect(getPortHighlight(inSource, 'B', 'premium', true)).toBeNull();
  });
});
