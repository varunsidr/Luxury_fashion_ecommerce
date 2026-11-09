export function permitsPublicSmokeRequest(method: string, pathname: string): boolean {
  return ["GET", "HEAD", "OPTIONS"].includes(method) &&
    !/^\/api\/(?:admin\/logout(?:\/|$)|test(?:\/|$)|dev(?:\/|$)|restock-notifications\/unsubscribe(?:\/|$))/.test(pathname);
}
