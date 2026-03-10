// State
let photos = [];
let db = null;

// DOM Elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const photosGrid = document.getElementById('photosGrid');
const generateBtn = document.getElementById('generateBtn');
const projectNameInput = document.getElementById('projectName');
const saveBtn = document.getElementById('saveBtn');
const newBtn = document.getElementById('newBtn');
const projectList = document.getElementById('projectList');
const toggleProjects = document.getElementById('toggleProjects');
const toggleArrow = document.getElementById('toggleArrow');
const notification = document.getElementById('notification');

// Initialize
init();

async function init() {
    await initDB();
    setupDropzone();
    setupGenerateButton();
    setupProjectControls();
    loadProjectList();
}

// ─── IndexedDB ──────────────────────────────────────────

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('cecb-photos-db', 1);
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains('projects')) {
                database.createObjectStore('projects', { keyPath: 'name' });
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve();
        };
        request.onerror = (e) => {
            console.error('IndexedDB error:', e);
            resolve(); // Continue without persistence
        };
    });
}

// ─── Project Management ─────────────────────────────────

function setupProjectControls() {
    saveBtn.addEventListener('click', saveProject);
    newBtn.addEventListener('click', newProject);

    toggleProjects.addEventListener('click', () => {
        projectList.classList.toggle('collapsed');
        toggleArrow.classList.toggle('collapsed');
    });
}

async function saveProject() {
    const name = projectNameInput.value.trim();
    if (!name) {
        showNotification('Veuillez entrer un nom de projet');
        return;
    }
    if (photos.length === 0) {
        showNotification('Aucune photo à sauvegarder');
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Sauvegarde...';

    try {
        // Compress photos for storage
        const storedPhotos = await Promise.all(photos.map(async (photo) => {
            const compressed = await compressImageForStorage(photo.src);
            return { src: compressed, caption: photo.caption };
        }));

        const project = {
            name: name,
            date: new Date().toISOString(),
            photoCount: photos.length,
            photos: storedPhotos
        };

        const tx = db.transaction('projects', 'readwrite');
        const store = tx.objectStore('projects');
        store.put(project);

        tx.oncomplete = () => {
            loadProjectList();
            showNotification('Projet sauvegardé : ' + name);
        };
        tx.onerror = () => {
            showNotification('Erreur lors de la sauvegarde');
        };
    } catch (err) {
        console.error('Save error:', err);
        showNotification('Erreur lors de la sauvegarde');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Sauvegarder';
    }
}

function loadProject(name) {
    const tx = db.transaction('projects', 'readonly');
    const store = tx.objectStore('projects');
    const request = store.get(name);

    request.onsuccess = () => {
        const project = request.result;
        if (project) {
            projectNameInput.value = project.name;
            photos = project.photos.map((p, i) => ({
                id: Date.now() + i,
                src: p.src,
                caption: p.caption
            }));
            renderPhotos();
            updateGenerateButton();
            showNotification('Projet chargé : ' + project.name);
        }
    };
}

function deleteProject(name) {
    if (!confirm('Supprimer le projet "' + name + '" ?')) return;

    const tx = db.transaction('projects', 'readwrite');
    const store = tx.objectStore('projects');
    store.delete(name);

    tx.oncomplete = () => {
        loadProjectList();
        showNotification('Projet supprimé');
    };
}

function newProject() {
    if (photos.length > 0 && !confirm('Effacer le projet en cours ?')) return;
    projectNameInput.value = '';
    photos = [];
    renderPhotos();
    updateGenerateButton();
}

function loadProjectList() {
    if (!db) return;

    const tx = db.transaction('projects', 'readonly');
    const store = tx.objectStore('projects');
    const request = store.getAll();

    request.onsuccess = () => {
        renderProjectList(request.result);
    };
}

function renderProjectList(projects) {
    projectList.innerHTML = '';

    if (projects.length === 0) {
        const p = document.createElement('p');
        p.className = 'no-projects';
        p.textContent = 'Aucun projet sauvegardé';
        projectList.appendChild(p);
        return;
    }

    // Sort by date descending
    projects.sort((a, b) => new Date(b.date) - new Date(a.date));

    projects.forEach(project => {
        const date = new Date(project.date).toLocaleDateString('fr-CH');
        const item = document.createElement('div');
        item.className = 'project-item';

        const info = document.createElement('div');
        info.className = 'project-info';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'project-name';
        nameSpan.textContent = project.name;

        const metaSpan = document.createElement('span');
        metaSpan.className = 'project-meta';
        metaSpan.textContent = project.photoCount + ' photos \u00b7 ' + date;

        info.appendChild(nameSpan);
        info.appendChild(metaSpan);

        const actions = document.createElement('div');
        actions.className = 'project-actions';

        const loadBtn = document.createElement('button');
        loadBtn.className = 'btn-load';
        loadBtn.textContent = 'Charger';
        loadBtn.addEventListener('click', () => loadProject(project.name));

        const delBtn = document.createElement('button');
        delBtn.className = 'btn-delete';
        delBtn.textContent = '\u00d7';
        delBtn.title = 'Supprimer';
        delBtn.addEventListener('click', () => deleteProject(project.name));

        actions.appendChild(loadBtn);
        actions.appendChild(delBtn);

        item.appendChild(info);
        item.appendChild(actions);
        projectList.appendChild(item);
    });
}

// ─── Notification ───────────────────────────────────────

function showNotification(message) {
    notification.textContent = message;
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 2500);
}

// ─── Dropzone ───────────────────────────────────────────

function setupDropzone() {
    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
        fileInput.value = '';
    });
}

// Handle file imports
function handleFiles(files) {
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

    imageFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            photos.push({
                id: Date.now() + Math.random(),
                src: e.target.result,
                caption: ''
            });
            renderPhotos();
            updateGenerateButton();
        };
        reader.readAsDataURL(file);
    });
}

// ─── Photos Grid ────────────────────────────────────────

function renderPhotos() {
    photosGrid.innerHTML = '';

    photos.forEach((photo, index) => {
        const card = document.createElement('div');
        card.className = 'photo-card';
        card.draggable = true;
        card.dataset.index = index;

        const number = document.createElement('span');
        number.className = 'photo-number';
        number.textContent = index + 1;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.title = 'Supprimer';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deletePhoto(index);
        });

        const wrapper = document.createElement('div');
        wrapper.className = 'photo-wrapper';
        const img = document.createElement('img');
        img.src = photo.src;
        img.alt = 'Photo ' + (index + 1);
        wrapper.appendChild(img);

        const captionInput = document.createElement('input');
        captionInput.type = 'text';
        captionInput.className = 'caption-input';
        captionInput.placeholder = 'Légende...';
        captionInput.value = photo.caption;
        captionInput.addEventListener('input', (e) => {
            photos[index].caption = e.target.value;
        });

        card.appendChild(number);
        card.appendChild(deleteBtn);
        card.appendChild(wrapper);
        card.appendChild(captionInput);

        setupDragEvents(card, index);
        photosGrid.appendChild(card);
    });
}

// Setup drag events for reordering
function setupDragEvents(card, index) {
    card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', index);
        e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        document.querySelectorAll('.photo-card').forEach(c => {
            c.classList.remove('drag-over');
        });
    });

    card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const dragging = document.querySelector('.dragging');
        if (dragging !== card) {
            card.classList.add('drag-over');
        }
    });

    card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');

        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
        const toIndex = parseInt(card.dataset.index);

        if (fromIndex !== toIndex) {
            const [movedPhoto] = photos.splice(fromIndex, 1);
            photos.splice(toIndex, 0, movedPhoto);
            renderPhotos();
        }
    });
}

// Delete photo
function deletePhoto(index) {
    photos.splice(index, 1);
    renderPhotos();
    updateGenerateButton();
}

// Update generate button state
function updateGenerateButton() {
    generateBtn.disabled = photos.length === 0;
}

// ─── Generate PDF ───────────────────────────────────────

function setupGenerateButton() {
    generateBtn.addEventListener('click', generatePDF);
}

async function generatePDF() {
    const { jsPDF } = window.jspdf;
    const projectName = projectNameInput.value.trim() || 'Sans titre';

    // A4 dimensions in mm
    const pageWidth = 210;
    const pageHeight = 297;

    // Narrow margins
    const marginTop = 10;
    const marginBottom = 8;
    const marginLeft = 8;
    const marginRight = 8;

    // Title height (only on first page)
    const titleHeight = 12;

    // Grid setup: 2 columns x 3 rows
    const cols = 2;
    const rows = 3;
    const photosPerPage = cols * rows;

    // Calculate cell dimensions
    const contentWidth = pageWidth - marginLeft - marginRight;

    // Reduced gaps between photos
    const gapX = 5;
    const gapY = 4;

    const cellWidth = (contentWidth - gapX) / cols;

    // Caption space
    const captionHeight = 6;

    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    // Process photos
    const totalPages = Math.ceil(photos.length / photosPerPage);

    for (let page = 0; page < totalPages; page++) {
        if (page > 0) {
            pdf.addPage();
        }

        // Title only on first page
        const currentTitleHeight = (page === 0) ? titleHeight : 0;
        const currentMarginTop = (page === 0) ? marginTop : marginTop - 2;

        if (page === 0) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(14);
            pdf.text('D.1 Photo : ' + projectName, marginLeft, marginTop + 4);
        }

        // Calculate cell height based on available space
        const contentHeight = pageHeight - currentMarginTop - marginBottom - currentTitleHeight;
        const cellHeight = (contentHeight - (gapY * (rows - 1))) / rows;
        const photoMaxHeight = cellHeight - captionHeight - 2;

        // Photos for this page
        const startIndex = page * photosPerPage;
        const endIndex = Math.min(startIndex + photosPerPage, photos.length);

        for (let i = startIndex; i < endIndex; i++) {
            const photo = photos[i];
            const positionOnPage = i - startIndex;
            const col = positionOnPage % cols;
            const row = Math.floor(positionOnPage / cols);

            const cellX = marginLeft + col * (cellWidth + gapX);
            const cellY = currentMarginTop + currentTitleHeight + row * (cellHeight + gapY);

            try {
                const compressedSrc = await compressImageForPDF(photo.src);
                const imgData = await loadImage(photo.src);
                const imgRatio = imgData.width / imgData.height;

                let imgWidth = cellWidth;
                let imgHeight = imgWidth / imgRatio;

                if (imgHeight > photoMaxHeight) {
                    imgHeight = photoMaxHeight;
                    imgWidth = imgHeight * imgRatio;
                }

                // Center image in cell
                const imgX = cellX + (cellWidth - imgWidth) / 2;
                const imgY = cellY;

                pdf.addImage(compressedSrc, 'JPEG', imgX, imgY, imgWidth, imgHeight);

                // Caption
                if (photo.caption) {
                    pdf.setFontSize(8);
                    pdf.setFont('helvetica', 'normal');
                    const captionY = cellY + imgHeight + 3;
                    pdf.text(photo.caption, cellX, captionY, { align: 'left', maxWidth: cellWidth });
                }
            } catch (error) {
                console.error('Error loading image:', error);
            }
        }
    }

    // Save PDF
    pdf.save('Annexe_Photos_' + projectName.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf');
}

// ─── Image Utilities ────────────────────────────────────

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = reject;
        img.src = src;
    });
}

// Compress for PDF output (smaller, lower quality)
function compressImageForPDF(src, maxWidth = 600, quality = 0.50) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let w = img.width;
            let h = img.height;

            if (w > maxWidth) {
                h = Math.round(h * maxWidth / w);
                w = maxWidth;
            }

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);

            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = src;
    });
}

// Compress for storage (higher quality for later re-editing)
function compressImageForStorage(src, maxWidth = 800, quality = 0.65) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let w = img.width;
            let h = img.height;

            if (w > maxWidth) {
                h = Math.round(h * maxWidth / w);
                w = maxWidth;
            }

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);

            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = src;
    });
}
