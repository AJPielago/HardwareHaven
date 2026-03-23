export function formatPeso(value) {
  const n = Number(value || 0);
  try {
    return n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
  } catch (e) {
    return `₱${n.toFixed(2)}`;
  }
}

export default formatPeso;
