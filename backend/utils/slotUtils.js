const IST_OFFSET_MIN = 330; // Asia/Kolkata = UTC+5:30, DST nahi
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const toHHMM = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// Date jiske UTC fields IST ki wall-clock dikhate hain
const istNow = () => new Date(Date.now() + IST_OFFSET_MIN * 60000);

export const todayIST = () => istNow().toISOString().slice(0, 10);

export const addDaysToDateString = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// YYYY-MM-DD aur real date (2026-02-30 reject hoga)
export const isValidDateString = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export const dayKeyOf = (dateStr) =>
  DAY_KEYS[new Date(`${dateStr}T00:00:00Z`).getUTCDay()];

export const generateSlots = ({ availability, slotDurationMins }, dateStr) => {
  const dayKey = dayKeyOf(dateStr);
  const now = istNow();
  const isToday = dateStr === now.toISOString().slice(0, 10);
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const [y, mo, d] = dateStr.split('-').map(Number);

  const ranges = availability
    .filter((a) => a.day.slice(0, 3).toLowerCase() === dayKey)
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

  const slots = [];
  for (const r of ranges) {
    const end = toMinutes(r.endTime);
    // slot poora range ke andar fit hona chahiye, buffer nahi
    for (let s = toMinutes(r.startTime); s + slotDurationMins <= end; s += slotDurationMins) {
      if (isToday && s <= nowMin) continue; // guzra hua slot hatao
      slots.push({
        startTime: toHHMM(s),
        endTime: toHHMM(s + slotDurationMins),
        startAt: new Date(Date.UTC(y, mo - 1, d, 0, s) - IST_OFFSET_MIN * 60000).toISOString(),
      });
    }
  }
  return slots;
};