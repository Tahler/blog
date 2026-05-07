export function getEnv(name: string) {
  const isVite = typeof import.meta !== "undefined" && "env" in import.meta;
  if (isVite) {
    const value = import.meta.env[name];
    if (value) {
      return value;
    }
  }
  return process.env[name];
}
