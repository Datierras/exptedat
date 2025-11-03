// EventBus minimal (pub/sub)
export const EventBus = (() => {
  const topics = new Map();
  return {
    on(topic, handler) {
      if (!topics.has(topic)) topics.set(topic, new Set());
      topics.get(topic).add(handler);
      return () => topics.get(topic)?.delete(handler);
    },
    emit(topic, payload) {
      topics.get(topic)?.forEach(h => h(payload));
    }
  };
})();
