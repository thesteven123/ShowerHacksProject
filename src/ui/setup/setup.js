(() => {
  const $ = (id) => document.getElementById(id);
  const traits = [
    ['chaos', 'Chaos', '↯', '#d8ee85', 'Keeps it together', 'Absolute wildcard'],
    ['brainrot', 'Brainrot', '✳', '#bba9dc', 'Touching grass', 'Chronically online'],
    ['competitive', 'Competitive', '↗', '#e9b08c', 'Just here for fun', 'Has to win'],
    ['friendliness', 'Friendliness', '♡', '#95c9b3', 'Personal space, please', 'Everyone’s bestie'],
  ];
  const presets = {
    wildcard: { chaos: 9, brainrot: 8, competitive: 6, friendliness: 5 },
    sweetheart: { chaos: 2, brainrot: 3, competitive: 2, friendliness: 10 },
    tryhard: { chaos: 6, brainrot: 5, competitive: 10, friendliness: 4 },
  };
  let personality = { chaos: 5, brainrot: 5, competitive: 5, friendliness: 5 };
  let photo = null;
  let currentStep = 'photo';
  let photoRevision = 0;
  function crewMember(id, name, personality) {
    const base = `../built/${id}`;
    return {
      id,
      name,
      builtIn: true,
      personality: { ...personality },
      photo: { url: `${base}/${id}-portrait.png`, name: `${name}.png`, sample: false, file: null },
      bodyUrl: `${base}/pipeline/1-scaled-256.png`,
      appearance: { type: 'photo', hue: 0 },
    };
  }
  let friends = [
    crewMember('maanya-v3', 'Maanya', presets.wildcard),
    crewMember('kelvin-v3', 'Kelvin', presets.sweetheart),
    crewMember('philip-v3', 'Philip', { chaos: 4, brainrot: 3, competitive: 7, friendliness: 6 }),
    crewMember('steven-v3', 'Steven', presets.tryhard),
  ];
  let editingId = null;
  let deletingId = null;
  let editPersonality = null;
  let toastTimer;
  let generationVersion = 0;
  let generating = false;
  let readyFriend = null;
  const sample = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="480" viewBox="0 0 320 480"><rect width="320" height="480" rx="24" fill="#dce8bd"/><ellipse cx="160" cy="435" rx="66" ry="10" fill="#94a76e" opacity=".4"/><path d="M128 316v105h26V316m21 0v105h26V316" fill="#526e43" stroke="#3f5832" stroke-width="8" stroke-linejoin="round"/><rect x="99" y="178" width="120" height="165" rx="45" fill="#ac9bc6" stroke="#665278" stroke-width="5"/><rect x="70" y="194" width="33" height="119" rx="16" fill="#ac9bc6" stroke="#665278" stroke-width="5" transform="rotate(8 85 196)"/><rect x="217" y="194" width="33" height="119" rx="16" fill="#ac9bc6" stroke="#665278" stroke-width="5" transform="rotate(-8 232 196)"/><rect x="104" y="70" width="112" height="133" rx="48" fill="#dbb08f" stroke="#8c654d" stroke-width="5"/><path d="M105 110q0-56 56-56t54 56q-36-9-45-24-24 25-65 24" fill="#526644"/><rect x="127" y="123" width="13" height="22" rx="6" fill="#35382d"/><rect x="182" y="123" width="13" height="22" rx="6" fill="#35382d"/><path d="M147 162q14 13 28 0" fill="none" stroke="#855b43" stroke-width="4" stroke-linecap="round"/><text x="160" y="268" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="29" fill="#665278">tm.</text><text x="160" y="461" text-anchor="middle" font-family="monospace" font-size="10" fill="#63754d">SAMPLE ILLUSTRATION</text></svg>');
  const show = (id, visible) => { $(id).hidden = !visible; };
  const message = (id, value = '') => { $(id).textContent = value; show(id, Boolean(value)); };
  function toast(value) {
    clearTimeout(toastTimer);
    message('toast', value);
    toastTimer = setTimeout(() => show('toast', false), 3800);
  }
  function controls(id, values, prefix, onChange) {
    $(id).replaceChildren();
    for (const [key, label, symbol, color, low, high] of traits) {
      const row = document.createElement('div');
      row.className = 'trait-control';
      row.style.setProperty('--trait-color', color);
      row.style.setProperty('--trait-fill', `${values[key] * 10}%`);
      row.innerHTML = `<label for="${prefix}-${key}"><span><span class="trait-symbol">${symbol}</span>${label}</span><output>${values[key]} <small>/ 10</small></output></label><input id="${prefix}-${key}" type="range" min="0" max="10" step="1" value="${values[key]}"/><div class="trait-endpoints"><span>${low}</span><span>${high}</span></div>`;
      const input = row.querySelector('input');
      input.addEventListener('input', () => {
        values[key] = Number(input.value);
        row.style.setProperty('--trait-fill', `${values[key] * 10}%`);
        row.querySelector('output').innerHTML = `${values[key]} <small>/ 10</small>`;
        onChange();
      });
      $(id).append(row);
    }
  }
  function refreshTraits() {
    controls('trait-controls', personality, 'trait', updatePreview);
  }
  function chips(id, values) {
    $(id).replaceChildren();
    traits.forEach(([key, label, symbol]) => {
      const chip = document.createElement('span');
      chip.textContent = `${symbol} ${label} ${values[key]}`;
      $(id).append(chip);
    });
  }
  function updatePreview() {
    $('name-count').textContent = `${$('friend-name').value.length} / 32`;
    $('preview-name').textContent = $('friend-name').value.trim() || 'Your friend, but smaller.';
    const complete = currentStep === 'ready' && readyFriend;
    $('preview-type').textContent = complete ? 'YOUR TINY FRIEND' : photo ? 'SOURCE FILE' : 'CHARACTER PREVIEW';
    $('preview-badge').textContent = complete ? 'DEMO CHARACTER' : 'IN THE MAKING';
    $('preview-description').textContent = complete ? 'Big personality. Now in a smaller package.' : photo ? 'Ready for a little transformation.' : 'Small size. Questionable intentions.';
    $('specimen-caption').textContent = complete ? 'DEMO APPEARANCE · NOT PHOTO-GENERATED' : photo ? 'SELECTED LOCALLY · NEVER UPLOADED' : 'YOUR FUTURE DESKTOP MENACE';
    show('preview-mascot', !photo && !complete);
    show('specimen-photo', Boolean(photo) && !complete);
    show('specimen-character', Boolean(complete));
    show('preview-sticker', !photo && !complete);
    if (complete) mountDemo($('specimen-character'), readyFriend.appearance);
    if (photo) $('specimen-photo').src = photo.url;
    chips('preview-traits', { chaos: personality.chaos, brainrot: personality.brainrot, competitive: personality.competitive, friendliness: personality.friendliness });
  }
  function step(next) {
    currentStep = next;
    for (const name of ['photo', 'personality', 'generating', 'ready']) show(`${name}-step`, name === next);
    const active = next === 'generating' ? 'ready' : next;
    for (const name of ['photo', 'personality', 'ready']) {
      $(`step-${name}`).classList.toggle('current', name === active);
      $(`step-${name}`).classList.toggle('complete', ['photo', 'personality', 'ready'].indexOf(name) < ['photo', 'personality', 'ready'].indexOf(active));
      $(`step-${name}`).removeAttribute('aria-current');
    }
    $(`step-${active}`).setAttribute('aria-current', 'step');
    if (next !== 'photo') $(`${next}-title`).focus({ preventScroll: true });
    updatePreview();
  }
  function view(name) {
    show('create-view', name === 'create');
    show('roster-view', name === 'roster');
    ['create', 'roster'].forEach((key) => {
      $(`nav-${key}`).classList.toggle('selected', key === name);
      if (key === name) $(`nav-${key}`).setAttribute('aria-current', 'page');
      else $(`nav-${key}`).removeAttribute('aria-current');
    });
    if (name === 'roster') renderRoster();
    window.scrollTo({ top: 0 });
  }
  function releasePhoto(old) {
    if (old?.url.startsWith('blob:') && !friends.some((friend) => friend.photo.url === old.url)) URL.revokeObjectURL(old.url);
  }
  function setPhoto(next) {
    const old = photo;
    photo = next;
    if (old?.url !== next?.url) releasePhoto(old);
    show('drop-empty', !photo);
    show('photo-selected', Boolean(photo));
    show('photo-meta', Boolean(photo));
    if (photo) {
      $('photo-image').src = photo.url;
      $('photo-filename').textContent = photo.name;
      $('photo-file-note').textContent = photo.previewUnavailable ? 'Preview unavailable. File accepted for the demo.' : 'Selected locally — ready to continue.';
    } else {
      $('photo-image').removeAttribute('src');
      $('specimen-photo').removeAttribute('src');
    }
    updatePreview();
  }
  async function upload(files) {
    if (!files.length || generating) return;
    const revision = ++photoRevision;
    message('form-error');
    const file = files[0];
    setPhoto({ url: sample, name: file.name || 'Selected file', file, sample: false, previewUnavailable: true });
    if (files.length > 1) toast('First file selected. Add more friends separately.');
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) return;
    const url = URL.createObjectURL(file);
    const image = new Image();
    const loaded = new Promise((resolve) => {
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
    });
    image.src = url;
    let timer;
    const valid = await Promise.race([loaded, new Promise((resolve) => { timer = setTimeout(() => resolve(false), 1800); })]);
    clearTimeout(timer);
    if (valid && revision === photoRevision) setPhoto({ url, name: file.name, file, sample: false });
    else URL.revokeObjectURL(url);
  }
  function reset() {
    if (generating) return;
    readyFriend = null;
    photoRevision++;
    $('character-form').reset();
    personality = { chaos: 5, brainrot: 5, competitive: 5, friendliness: 5 };
    setPhoto(null);
    message('form-error');
    message('generation-error');
    refreshTraits();
    step('photo');
    view('create');
  }
  function start() {
    if (generating) return;
    if (currentStep === 'ready') reset();
    else view('create');
  }
  function example() {
    if (generating) return;
    reset();
    $('friend-name').value = 'Alex';
    $('photo-consent').checked = true;
    setPhoto({ url: sample, name: 'Sample illustration · not a real photo', sample: true });
    personality = { ...presets.wildcard };
    refreshTraits();
    updatePreview();
    toast('Sample setup loaded. Change anything you like.');
  }
  function openEdit(id) {
    const friend = friends.find((item) => item.id === id);
    editingId = id;
    editPersonality = { ...friend.personality };
    $('edit-name').value = friend.name;
    message('edit-error');
    controls('edit-traits', editPersonality, 'edit', () => {});
    $('edit-dialog').showModal();
  }
  function notifyDrafts() {
    window.dispatchEvent(new CustomEvent('tiny-menaces:setup-drafts-changed', {
      detail: friends.map(friend => ({
        draftId: friend.id,
        name: friend.name,
        personality: { ...friend.personality },
        photo: friend.photo.file ?? null,
        isSample: friend.photo.sample,
        isDemo: true,
        generationStatus: 'simulated',
        appearance: { ...friend.appearance },
      })),
    }));
  }
  function paintLook(stage, friend) {
    stage.classList.add('photo-crew');
    stage.replaceChildren();
    const face = document.createElement('img');
    face.className = 'crew-face';
    face.alt = `${friend.name}'s face`;
    face.src = friend.photo.url;
    const body = document.createElement('img');
    body.className = 'crew-body';
    body.alt = '';
    body.src = friend.bodyUrl;
    stage.append(face, body);
  }
  function renderRoster() {
    $('roster-count').textContent = friends.length;
    $('roster-summary').textContent = `${friends.length} friends in your crew · Maanya, Kelvin, Philip, and Steven`;
    show('roster-empty', !friends.length);
    $('roster-grid').replaceChildren();
    for (const friend of friends) {
      const card = document.createElement('article');
      card.className = 'friend-card';
      card.innerHTML = '<div class="friend-card-header"><span class="source-tag">UI DRAFT</span><button class="icon-button remove-draft" aria-label="Remove draft"><svg class="icon"><use href="#i-trash"/></svg></button></div><div class="friend-stage"></div><div class="friend-details"><h2></h2><p>Source image · not generated</p><div class="trait-chips"></div><button class="button secondary full-width edit-draft">Edit details ↗</button></div>';
      card.querySelector('h2').textContent = friend.name;
      if (friend.builtIn) {
        card.querySelector('.source-tag').textContent = 'YOUR CREW';
        card.querySelector('.friend-details p').textContent = 'Photo face and body';
        paintLook(card.querySelector('.friend-stage'), friend);
        card.querySelector('.remove-draft').hidden = true;
      } else {
        card.querySelector('.source-tag').textContent = 'DEMO CHARACTER';
        card.querySelector('.friend-details p').textContent = 'Demo appearance · no backend';
        mountDemo(card.querySelector('.friend-stage'), friend.appearance);
      }
      traits.forEach(([key, label]) => {
        const chip = document.createElement('span');
        chip.textContent = `${label} ${friend.personality[key]}`;
        card.querySelector('.trait-chips').append(chip);
      });
      card.querySelector('.edit-draft').setAttribute('aria-label', `Edit ${friend.name}`);
      card.querySelector('.edit-draft').addEventListener('click', () => openEdit(friend.id));
      card.querySelector('.remove-draft').setAttribute('aria-label', `Remove ${friend.name}`);
      card.querySelector('.remove-draft').addEventListener('click', () => {
        deletingId = friend.id;
        $('delete-title').textContent = `Remove ${friend.name}?`;
        $('delete-dialog').showModal();
      });
      $('roster-grid').append(card);
    }
  }
  $('character-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (currentStep !== 'photo') return;
    message('form-error');
    if (!$('friend-name').value.trim()) $('friend-name').value = 'Your friend';
    if (!photo) setPhoto({ url: sample, name: 'Demo input', file: null, sample: true });
    step('personality');
  });
  $('friend-name').addEventListener('input', updatePreview);
  $('drop-zone').addEventListener('click', () => $('photo-input').click());
  $('photo-input').addEventListener('change', (event) => {
    if (event.target.files.length) void upload([...event.target.files]);
    event.target.value = '';
  });
  for (const name of ['dragenter', 'dragover']) $('drop-zone').addEventListener(name, (event) => { event.preventDefault(); $('drop-zone').classList.add('dragging'); });
  for (const name of ['dragleave', 'drop']) $('drop-zone').addEventListener(name, (event) => { event.preventDefault(); $('drop-zone').classList.remove('dragging'); });
  $('drop-zone').addEventListener('drop', (event) => void upload([...event.dataTransfer.files]));
  document.addEventListener('dragover', (event) => event.preventDefault());
  document.addEventListener('drop', (event) => event.preventDefault());
  $('remove-photo').addEventListener('click', () => { photoRevision++; setPhoto(null); });
  $('back-photo').addEventListener('click', () => step('photo'));
  document.querySelectorAll('[data-preset]').forEach((button) => button.addEventListener('click', () => {
    personality = { ...presets[button.dataset.preset] };
    refreshTraits();
    updatePreview();
  }));
  $('shuffle-traits').addEventListener('click', () => {
    traits.forEach(([key]) => { personality[key] = Math.floor(Math.random() * 11); });
    refreshTraits();
    updatePreview();
  });
  function mountDemo(container, appearance) {
    const figure = $('preview-mascot').cloneNode(true);
    figure.removeAttribute('id');
    figure.hidden = false;
    figure.classList.add('demo-figure');
    figure.style.setProperty('--demo-hue', `${appearance?.hue || 0}deg`);
    container.replaceChildren(figure);
  }
  function busy(value) {
    generating = value;
    for (const id of ['nav-create', 'nav-roster', 'try-examples', 'generate-button']) $(id).disabled = value;
    document.querySelector('.brand').setAttribute('aria-disabled', String(value));
  }
  $('generate-button').addEventListener('click', async () => {
    if (currentStep !== 'personality' || generating) return;
    if (friends.length >= 20) return message('generation-error', 'This demo supports up to 20 characters. Remove one to add another.');
    const version = ++generationVersion;
    busy(true);
    photoRevision++;
    const friend = { id: crypto.randomUUID(), name: $('friend-name').value.trim() || 'Your friend', photo: { ...photo }, personality: { ...personality }, appearance: { type: 'demo-mascot', hue: (friends.length * 67) % 360 } };
    $('generating-title').textContent = `Making a tiny ${friend.name}…`;
    step('generating');
    const labels = ['Preparing your character…', 'Finding their tiny look…', 'Adding a little personality…'];
    for (let i = 0; i < labels.length; i++) {
      $('generation-status').textContent = labels[i];
      $('generation-meter').value = i + 1;
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (version !== generationVersion) return;
    }
    readyFriend = friend;
    friends.push(friend);
    busy(false);
    renderRoster();
    notifyDrafts();
    chips('ready-traits', friend.personality);
    mountDemo($('ready-figure'), friend.appearance);
    $('ready-title').textContent = `Meet tiny ${friend.name}.`;
    step('ready');
  });
  $('cancel-generation').addEventListener('click', () => {
    generationVersion++;
    busy(false);
    step('personality');
  });
  document.querySelector('.brand').addEventListener('click', (event) => { if (generating) event.preventDefault(); });
  $('nav-create').addEventListener('click', start);
  $('nav-roster').addEventListener('click', () => view('roster'));
  $('launch-ready').addEventListener('click', () => view('roster'));
  ['roster-add', 'empty-create'].forEach((id) => $(id).addEventListener('click', start));
  $('create-another').addEventListener('click', reset);
  ['try-examples', 'empty-examples'].forEach((id) => $(id).addEventListener('click', example));
  $('help-button').addEventListener('click', () => $('help-dialog').showModal());
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
  $('edit-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = $('edit-name').value.trim();
    if (!name) return message('edit-error', 'Please enter a name.');
    const friend = friends.find((item) => item.id === editingId);
    friend.name = name;
    friend.personality = { ...editPersonality };
    $('edit-dialog').close();
    renderRoster();
    notifyDrafts();
    toast('Draft updated.');
  });
  $('confirm-delete').addEventListener('click', () => {
    const old = friends.find((item) => item.id === deletingId);
    friends = friends.filter((item) => item.id !== deletingId);
    if (old && old.photo.url !== photo?.url) releasePhoto(old.photo);
    $('delete-dialog').close();
    renderRoster();
    notifyDrafts();
    toast('Draft removed.');
  });
  refreshTraits();
  updatePreview();
  renderRoster();
  view('roster');
})();
