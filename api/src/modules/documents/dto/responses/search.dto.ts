import type { SearchHit } from '../../types/search-hit.type';

export interface SearchResponse {
  total: number;
  hits: SearchHit[];
}
