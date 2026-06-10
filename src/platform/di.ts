export type ServiceFactory<T> = () => T;

const services = new Map<string, ServiceFactory<unknown>>();

export function registerService<T>(key: string, factory: ServiceFactory<T>): void {
  services.set(key, factory as ServiceFactory<unknown>);
}

export function getService<T>(key: string): T {
  const factory = services.get(key);
  if (!factory) {
    throw new Error(`Service ${key} not registered`);
  }
  return factory() as T;
}
