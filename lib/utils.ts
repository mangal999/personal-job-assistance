export function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function jobHash(job: { title: string; company: string; apply_url: string }) {
  return hashString(`${job.title.toLowerCase()}|${job.company.toLowerCase()}|${job.apply_url}`);
}
