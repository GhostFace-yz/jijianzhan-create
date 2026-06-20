/**
 * 存储服务抽象
 * 用于保存渲染输出的 MP4 等媒体文件，并返回可访问 URL。
 */
export interface StorageService {
  /**
   * 上传/保存本地文件，返回可访问 URL
   * @param localPath 本地绝对路径
   * @param key 存储 key（如 project/{projectId}/episode/{epId}/output.mp4）
   */
  save(localPath: string, key: string): Promise<{ url: string } >;
}
