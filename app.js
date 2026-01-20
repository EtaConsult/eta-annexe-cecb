// State
let photos = [];

// DOM Elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const photosGrid = document.getElementById('photosGrid');
const generateBtn = document.getElementById('generateBtn');
const projectNameInput = document.getElementById('projectName');

// Initialize
init();

function init() {
    setupDropzone();
    setupGenerateButton();
}

// Dropzone setup
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

// Render photos grid
function renderPhotos() {
    photosGrid.innerHTML = '';

    photos.forEach((photo, index) => {
        const card = document.createElement('div');
        card.className = 'photo-card';
        card.draggable = true;
        card.dataset.index = index;

        card.innerHTML = `
            <span class="photo-number">${index + 1}</span>
            <button class="delete-btn" title="Supprimer">&times;</button>
            <div class="photo-wrapper">
                <img src="${photo.src}" alt="Photo ${index + 1}">
            </div>
            <input type="text" class="caption-input" placeholder="Légende..." value="${photo.caption}">
        `;

        // Delete button
        card.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deletePhoto(index);
        });

        // Caption input
        card.querySelector('.caption-input').addEventListener('input', (e) => {
            photos[index].caption = e.target.value;
        });

        // Drag events for reordering
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

// Setup generate button
function setupGenerateButton() {
    generateBtn.addEventListener('click', generatePDF);
}

// Generate PDF
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
            pdf.text(`D.1 Photo : ${projectName}`, marginLeft, marginTop + 4);
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

            // Load and add image
            try {
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

                pdf.addImage(photo.src, 'JPEG', imgX, imgY, imgWidth, imgHeight);

                // Caption - aligned left, close to photo
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
    pdf.save(`Annexe_Photos_${projectName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}

// Load image and get dimensions
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = reject;
        img.src = src;
    });
}
