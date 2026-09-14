// Événements internes à l'app, pour qu'un écran signale un changement à un autre (ex. pastille des messages).

type AppEvent = 'chat:read' | 'sessions:changed' | 'coach:changed';

const listeners = new Map<AppEvent, Set<() => void>>();

export function emitAppEvent(event: AppEvent) {
  listeners.get(event)?.forEach((listener) => listener());
}

export function onAppEvent(event: AppEvent, listener: () => void) {
  const set = listeners.get(event) ?? new Set();
  listeners.set(event, set);
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}
