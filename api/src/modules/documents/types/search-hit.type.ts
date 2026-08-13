export interface SearchHit {
  documentId: string;
  userFilename: string;
  createdAt: string;
  score: number;
  highlights: string[];
}
