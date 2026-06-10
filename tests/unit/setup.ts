// Pin timezone so date math in tests is deterministic regardless of host TZ.
// The services do raw millisecond arithmetic on local-time Dates, which is
// DST-sensitive in zones like Europe/Bucharest.
process.env.TZ = 'UTC'
