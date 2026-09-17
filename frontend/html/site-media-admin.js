const siteSettingsForm = document.getElementById("site-settings-form");
const authToken = localStorage.getItem("authToken");

async function adminRequest(url, options = {}) {
  const headers = {
    Authorization: `Bearer ${authToken}`,
    ...(options.headers || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, { ...options, headers });
  if (response.status === 204) return {};

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `HTTP ${response.status}`);
  }
  return payload;
}

function mediaUrl(mediaKey) {
  return `/api/site-media/${mediaKey}?v=${Date.now()}`;
}

function refreshPreview(mediaKey) {
  const preview = document.querySelector(`[data-media-preview="${mediaKey}"]`);
  const empty = document.querySelector(`[data-media-empty="${mediaKey}"]`);
  if (!preview || !empty) return;

  const candidate = mediaUrl(mediaKey);
  const probe = new Image();
  probe.onload = () => {
    preview.src = candidate;
    preview.hidden = false;
    empty.hidden = true;
  };
  probe.onerror = () => {
    preview.removeAttribute("src");
    preview.hidden = true;
    empty.hidden = false;
  };
  probe.src = candidate;
}

function setStatus(message, type = "success") {
  const status = document.getElementById("site-media-status");
  if (!status) return;
  status.textContent = message;
  status.className = `admin-message ${type}`;
  status.hidden = false;
}

function renderEditor(mediaSettings) {
  const wrapper = document.createElement("section");
  wrapper.className = "site-media-admin";
  wrapper.setAttribute("aria-labelledby", "site-media-heading");
  wrapper.innerHTML = `
    <div class="panel-heading">
      <p class="eyebrow">Branding og hero</p>
      <h3 id="site-media-heading">Billeder og video</h3>
      <p>Upload logo og hero-billede direkte til hjemmesiden. PNG, JPEG og WebP understøttes op til 5 MB.</p>
    </div>
    <div id="site-media-status" class="admin-message" role="status" hidden></div>
    <div class="site-media-admin-grid">
      <form class="form-card site-media-card" data-media-form="logo">
        <h3>Vennekredsen-logo</h3>
        <div class="site-media-preview">
          <span data-media-empty="logo">Intet brugerdefineret logo</span>
          <img data-media-preview="logo" alt="Nuværende Vennekredsen-logo" hidden />
        </div>
        <div class="form-field">
          <label for="site-logo-file">Vælg logo</label>
          <input id="site-logo-file" name="file" type="file" accept="image/png,image/jpeg,image/webp" required />
        </div>
        <div class="site-media-actions">
          <button class="button" type="submit">Upload logo</button>
          <button class="button secondary" type="button" data-media-delete="logo">Fjern logo</button>
        </div>
      </form>
      <form class="form-card site-media-card" data-media-form="hero-background">
        <h3>Hero-baggrund</h3>
        <div class="site-media-preview">
          <span data-media-empty="hero-background">Standardbilledet bruges</span>
          <img data-media-preview="hero-background" alt="Nuværende hero-baggrund" hidden />
        </div>
        <div class="form-field">
          <label for="hero-background-file">Vælg hero-billede</label>
          <input id="hero-background-file" name="file" type="file" accept="image/png,image/jpeg,image/webp" required />
        </div>
        <div class="site-media-actions">
          <button class="button" type="submit">Upload hero-billede</button>
          <button class="button secondary" type="button" data-media-delete="hero-background">Fjern hero-billede</button>
        </div>
      </form>
    </div>
    <form id="site-video-form" class="form-card site-media-card">
      <h3>Hero-video</h3>
      <div class="form-field full">
        <label for="hero-video-url">Direkte video-URL</label>
        <input id="hero-video-url" name="hero_video_url" type="url" maxlength="1000" placeholder="https://cdn.example.dk/hero.mp4" />
        <span class="form-help">Direkte HTTP(S)-link til MP4 eller WebM. YouTube/Vimeo er ikke understøttet i denne version.</span>
      </div>
      <label class="toggle-row">
        <input name="hero_video_enabled" type="checkbox" />
        <span>Brug video som hero-baggrund</span>
      </label>
      <div class="form-actions">
        <button class="button" type="submit">Gem videoindstillinger</button>
      </div>
    </form>
  `;

  siteSettingsForm.insertAdjacentElement("afterend", wrapper);

  const videoForm = document.getElementById("site-video-form");
  videoForm.elements.hero_video_url.value = mediaSettings.hero_video_url || "";
  videoForm.elements.hero_video_enabled.checked = Boolean(
    mediaSettings.hero_video_enabled
  );

  document.querySelectorAll("[data-media-form]").forEach(form => {
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const mediaKey = form.dataset.mediaForm;
      const file = form.elements.file.files[0];
      if (!file) {
        setStatus("Vælg en billedfil først.", "error");
        return;
      }

      const body = new FormData();
      body.append("file", file);
      try {
        await adminRequest(`/api/admin/site-media/${mediaKey}`, {
          method: "PUT",
          body,
        });
        form.reset();
        refreshPreview(mediaKey);
        setStatus("Billedet er gemt.");
      } catch (error) {
        setStatus(error.message, "error");
      }
    });
  });

  document.querySelectorAll("[data-media-delete]").forEach(button => {
    button.addEventListener("click", async () => {
      const mediaKey = button.dataset.mediaDelete;
      try {
        await adminRequest(`/api/admin/site-media/${mediaKey}`, {
          method: "DELETE",
        });
        refreshPreview(mediaKey);
        setStatus("Billedet er fjernet.");
      } catch (error) {
        setStatus(error.message, "error");
      }
    });
  });

  videoForm.addEventListener("submit", async event => {
    event.preventDefault();
    try {
      const payload = await adminRequest("/api/admin/site-video", {
        method: "PUT",
        body: JSON.stringify({
          hero_video_url: videoForm.elements.hero_video_url.value.trim(),
          hero_video_enabled: videoForm.elements.hero_video_enabled.checked,
        }),
      });
      videoForm.elements.hero_video_url.value = payload.media.hero_video_url || "";
      videoForm.elements.hero_video_enabled.checked = Boolean(
        payload.media.hero_video_enabled
      );
      setStatus("Videoindstillingerne er gemt.");
    } catch (error) {
      setStatus(error.message, "error");
    }
  });

  refreshPreview("logo");
  refreshPreview("hero-background");
}

async function initializeMediaEditor() {
  if (!siteSettingsForm || !authToken) return;

  try {
    const payload = await adminRequest("/api/admin/site-settings");
    renderEditor(payload.media || {});
  } catch {
    // The website resource is admin-only. Members should not see media controls.
  }
}

initializeMediaEditor();
