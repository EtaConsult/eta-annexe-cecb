/* ═══════════════════════════════════════════════════════
   CECB Plus — Annexe Photos
   Adapté de app.js pour mode projet (ProjectStore)
   ═══════════════════════════════════════════════════════ */

let photosState = [];

function initPhotos() {
    setupDropzone();
    setupPhotoGenerateButton();
    loadProjectPhotos();
}

/* ─── Load / Save via ProjectStore ────────────────────── */

async function loadProjectPhotos() {
    var pid = ProjectStore.getCurrentId();
    if (!pid) return;
    try {
        var saved = await ProjectStore.getPhotos(pid);
        if (saved && saved.length > 0) {
            photosState = saved.map(function (p, i) {
                return { id: Date.now() + i, src: p.src, caption: p.caption || '' };
            });
            renderPhotos();
            updatePhotoGenerateButton();
        }
    } catch (e) { console.error('Load photos error:', e); }
}

async function saveProjectPhotos() {
    var pid = ProjectStore.getCurrentId();
    if (!pid) return;
    try {
        var storedPhotos = await Promise.all(photosState.map(async function (photo) {
            var compressed = await compressImageForStorage(photo.src);
            return { src: compressed, caption: photo.caption };
        }));
        await ProjectStore.savePhotos(pid, storedPhotos);
    } catch (e) { console.error('Save photos error:', e); }
}

var _photoSaveTimeout = null;
function autoSavePhotos() {
    clearTimeout(_photoSaveTimeout);
    _photoSaveTimeout = setTimeout(saveProjectPhotos, 3000);
}

/* ─── Dropzone ────────────────────────────────────────── */

function setupDropzone() {
    var dropzone = document.getElementById('photoDropzone');
    var fileInput = document.getElementById('photoFileInput');
    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', function () { fileInput.click(); });
    dropzone.addEventListener('dragover', function (e) { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', function () { dropzone.classList.remove('dragover'); });
    dropzone.addEventListener('drop', function (e) { e.preventDefault(); dropzone.classList.remove('dragover'); handlePhotoFiles(e.dataTransfer.files); });
    fileInput.addEventListener('change', function (e) { handlePhotoFiles(e.target.files); fileInput.value = ''; });
}

function handlePhotoFiles(files) {
    Array.from(files).filter(function (f) { return f.type.startsWith('image/'); }).forEach(function (file) {
        var reader = new FileReader();
        reader.onload = function (e) {
            photosState.push({ id: Date.now() + Math.random(), src: e.target.result, caption: '' });
            renderPhotos();
            updatePhotoGenerateButton();
            autoSavePhotos();
        };
        reader.readAsDataURL(file);
    });
}

/* ─── Photos Grid ─────────────────────────────────────── */

function renderPhotos() {
    var grid = document.getElementById('photosGrid');
    if (!grid) return;
    grid.innerHTML = '';

    photosState.forEach(function (photo, index) {
        var card = document.createElement('div');
        card.className = 'photo-card';
        card.draggable = true;
        card.dataset.index = index;

        var number = document.createElement('span');
        number.className = 'photo-number';
        number.textContent = index + 1;

        var deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.title = 'Supprimer';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.addEventListener('click', function (e) { e.stopPropagation(); deletePhoto(index); });

        var wrapper = document.createElement('div');
        wrapper.className = 'photo-wrapper';
        var img = document.createElement('img');
        img.src = photo.src;
        img.alt = 'Photo ' + (index + 1);
        wrapper.appendChild(img);

        var captionInput = document.createElement('input');
        captionInput.type = 'text';
        captionInput.className = 'caption-input';
        captionInput.placeholder = 'Légende...';
        captionInput.value = photo.caption;
        captionInput.addEventListener('input', function (e) { photosState[index].caption = e.target.value; autoSavePhotos(); });

        card.appendChild(number);
        card.appendChild(deleteBtn);
        card.appendChild(wrapper);
        card.appendChild(captionInput);

        setupPhotoDragEvents(card, index);
        grid.appendChild(card);
    });
}

function setupPhotoDragEvents(card, index) {
    card.addEventListener('dragstart', function (e) { card.classList.add('dragging'); e.dataTransfer.setData('text/plain', index); e.dataTransfer.effectAllowed = 'move'; });
    card.addEventListener('dragend', function () { card.classList.remove('dragging'); document.querySelectorAll('.photo-card').forEach(function (c) { c.classList.remove('drag-over'); }); });
    card.addEventListener('dragover', function (e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!card.classList.contains('dragging')) card.classList.add('drag-over'); });
    card.addEventListener('dragleave', function () { card.classList.remove('drag-over'); });
    card.addEventListener('drop', function (e) {
        e.preventDefault(); card.classList.remove('drag-over');
        var fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
        var toIndex = parseInt(card.dataset.index);
        if (fromIndex !== toIndex) {
            var moved = photosState.splice(fromIndex, 1)[0];
            photosState.splice(toIndex, 0, moved);
            renderPhotos();
            autoSavePhotos();
        }
    });
}

function deletePhoto(index) {
    photosState.splice(index, 1);
    renderPhotos();
    updatePhotoGenerateButton();
    autoSavePhotos();
}

function updatePhotoGenerateButton() {
    var btn = document.getElementById('photoGenerateBtn');
    if (btn) btn.disabled = photosState.length === 0;
}

/* ─── Generate PDF ────────────────────────────────────── */

function setupPhotoGenerateButton() {
    var btn = document.getElementById('photoGenerateBtn');
    if (btn) btn.addEventListener('click', generatePhotoPDF);
}

async function generatePhotoPDF() {
    var jsPDF = window.jspdf.jsPDF;
    var pid = ProjectStore.getCurrentId();
    var project = pid ? ProjectStore.get(pid) : null;
    var projectName = project ? project.name : 'Sans titre';
    var projectAddress = (project && project.address && project.address.label) ? project.address.label : projectName;

    var pageWidth = 210, pageHeight = 297;
    var marginTop = 10, marginBottom = 8, marginLeft = 8, marginRight = 8;
    var titleHeight = 12;
    var cols = 2, rows = 3, photosPerPage = cols * rows;
    var contentWidth = pageWidth - marginLeft - marginRight;
    var gapX = 5, gapY = 4;
    var cellWidth = (contentWidth - gapX) / cols;
    var captionHeight = 6;

    var pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var totalPages = Math.ceil(photosState.length / photosPerPage);

    for (var page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();
        var currentTitleHeight = page === 0 ? titleHeight : 0;
        var currentMarginTop = page === 0 ? marginTop : marginTop - 2;
        if (page === 0) { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(14); pdf.text('D1. Photos : ' + projectAddress, marginLeft, marginTop + 4); }
        var contentHeight = pageHeight - currentMarginTop - marginBottom - currentTitleHeight;
        var cellHeight = (contentHeight - (gapY * (rows - 1))) / rows;
        var photoMaxHeight = cellHeight - captionHeight - 2;
        var startIndex = page * photosPerPage;
        var endIndex = Math.min(startIndex + photosPerPage, photosState.length);

        for (var i = startIndex; i < endIndex; i++) {
            var photo = photosState[i];
            var positionOnPage = i - startIndex;
            var col = positionOnPage % cols;
            var row = Math.floor(positionOnPage / cols);
            var cellX = marginLeft + col * (cellWidth + gapX);
            var cellY = currentMarginTop + currentTitleHeight + row * (cellHeight + gapY);
            try {
                var compressedSrc = await compressImageForPDF(photo.src);
                var imgData = await loadImageDimensions(photo.src);
                var imgRatio = imgData.width / imgData.height;
                var imgWidth = cellWidth, imgHeight = imgWidth / imgRatio;
                if (imgHeight > photoMaxHeight) { imgHeight = photoMaxHeight; imgWidth = imgHeight * imgRatio; }
                var imgX = cellX + (cellWidth - imgWidth) / 2;
                pdf.addImage(compressedSrc, 'JPEG', imgX, cellY, imgWidth, imgHeight);
                if (photo.caption) { pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.text(photo.caption, cellX, cellY + imgHeight + 3, { align: 'left', maxWidth: cellWidth }); }
            } catch (error) { console.error('Error loading image:', error); }
        }
    }
    pdf.save('D1_Photos_' + projectAddress.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf');
}

/* ─── Image Utilities ─────────────────────────────────── */

function loadImageDimensions(src) {
    return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () { resolve({ width: img.width, height: img.height }); };
        img.onerror = reject;
        img.src = src;
    });
}

function compressImageForPDF(src, maxWidth, quality) {
    maxWidth = maxWidth || 600; quality = quality || 0.50;
    return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () {
            var w = img.width, h = img.height;
            if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = src;
    });
}

function compressImageForStorage(src, maxWidth, quality) {
    maxWidth = maxWidth || 800; quality = quality || 0.65;
    return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () {
            var w = img.width, h = img.height;
            if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = src;
    });
}
