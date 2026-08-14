export const s3Service = {
  upload: async (
    url: string,
    headers: Record<string, string>,
    file: File,
  ): Promise<void> => {
    const sendable = { ...headers };
    delete sendable['Content-Length'];

    const response = await fetch(url, {
      method: 'PUT',
      headers: sendable,
      body: file,
    });

    if (!response.ok) {
      throw new Error(`S3 upload failed with ${response.status}`);
    }
  },
};
