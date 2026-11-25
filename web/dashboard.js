'use strict';
const el = (id) => document.getElementById(id);
function node(tag, value = '') {
  const n = document.createElement(tag);
  n.textContent = value;
  return n;
}
async function request(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw Error('Request failed');
  return response.json();
}
let names = new Map();
async function devices() {
  try {
    const data = await request('/devices');
    names = new Map(data.map((d) => [d.id, d.name]));
    el('rows').replaceChildren(
      ...data.map((d) => {
        const row = node('tr'),
          label = node('td', d.name || d.id);
        label.append(node('small', d.type));
        if (
          d.vendor === 'eufy' &&
          d.mapUpdated &&
          /^eufy:[a-f0-9]{64}$/.test(d.id)
        ) {
          const link = node('a', 'View map');
          link.href = '/eufy/maps/' + d.id.slice(5);
          label.append(
            link,
            node(
              'small',
              'Map received ' + new Date(d.mapUpdated).toLocaleString(),
            ),
          );
        }
        const status = node('span', d.status || 'Unknown');
        status.className = 'state';
        if (['online', 'on', 'normal'].includes(d.status))
          status.classList.add('active');
        if (['fault', 'offline'].includes(d.status))
          status.classList.add('fault');
        const cell = node('td');
        cell.append(status);
        if (Number.isFinite(d.batteryPercent))
          cell.append(node('small', d.batteryPercent + '% battery'));
        const stamp = new Date(d.lastUpdated);
        row.append(
          label,
          node('td', d.vendor),
          cell,
          node(
            'td',
            d.lastUpdated && Number.isFinite(+stamp)
              ? stamp.toLocaleString(undefined, {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })
              : 'Unknown',
          ),
        );
        return row;
      }),
    );
    el('device-count').textContent = data.length;
    el('device-message').textContent = data.length
      ? ''
      : 'The cache is empty. Refresh to look for devices.';
  } catch {
    el('device-message').textContent =
      'Could not read the device cache. Retry with Refresh cache.';
  }
}
async function rules() {
  try {
    const data = await request('/trygrs');
    el('rules').replaceChildren(
      ...data.map((r) => {
        const box = node('article');
        box.className = 'rule';
        const fields = node('dl');
        const entries = [
          ['Condition', r.condition],
          ['When', r.value],
          ['Action', r.action],
          ['Target', names.get(r.target) || r.target],
          ['Action value', r.actionValue],
          ['Offset', r.offset],
          ['Next device', r.chain],
        ];
        for (const [label, value] of entries) {
          if (value == null || value === '') continue;
          const field = node('div');
          field.append(node('dt', label), node('dd', value));
          fields.append(field);
        }
        box.append(node('h3', r.id), fields);
        return box;
      }),
    );
    el('rule-count').textContent = data.length;
    el('rule-message').textContent = data.length ? '' : 'No Trygrs defined.';
  } catch {
    el('rule-message').textContent =
      'Could not read rules. Reload to try again.';
  }
}
async function load() {
  await devices();
  await rules();
}
el('refresh').addEventListener('click', async () => {
  el('refresh').disabled = true;
  el('feedback').textContent = 'Refreshing device observations…';
  try {
    const { results } = await request('/devices/refresh', {
      method: 'POST',
      headers: { 'X-Trygr-Refresh': '1' },
    });
    el('feedback').textContent = results.join('  /  ');
  } catch {
    el('feedback').textContent = 'Refresh request failed. Try again.';
  } finally {
    await load();
    el('refresh').disabled = false;
  }
});
void load();
