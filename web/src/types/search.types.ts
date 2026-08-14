export interface SearchHit {
  documentId: string;
  userFilename: string;
  createdAt: string;
  score: number;
  highlights: string[];
}

export interface SearchResponse {
  total: number;
  hits: SearchHit[];
}
