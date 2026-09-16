function mapRunBlockPlain(b) {
  const out = {
    role: b.role,
    mode: b.mode,
    distance: b.distance,
    duration: b.duration,
    pace: b.pace,
    repetitions: b.repetitions,
    description: b.description,
    recoveryMode: b.recoveryMode,
    recoveryDistance: b.recoveryDistance,
    recoveryDuration: b.recoveryDuration,
    recoveryPace: b.recoveryPace,
    recoveryDescription: b.recoveryDescription,
    notes: b.notes,
    order: b.order
  };
  if (b.children && b.children.length) {
    out.children = b.children.map(mapRunBlockPlain);
  }
  return out;
}

module.exports = { mapRunBlockPlain };
