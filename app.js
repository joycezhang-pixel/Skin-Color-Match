/* =========================================================================
   ChromaGlow — App Logic
   ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const video = document.getElementById('camera-feed');
    const canvas = document.getElementById('capture-canvas');
    const cameraBtn = document.getElementById('camera-btn');
    const analyzeBtn = document.getElementById('analyze-btn');
    const imageUpload = document.getElementById('image-upload');
    const resultsPanel = document.getElementById('results-panel');
    const initialMessage = document.getElementById('initial-message');
    const analysisContent = document.getElementById('analysis-content');
    const sampledColorBox = document.getElementById('sampled-color-box');
    const colorHex = document.getElementById('color-hex');
    const colorHsl = document.getElementById('color-hsl');
    const mappedSeason = document.getElementById('mapped-season');
    const seasonDescription = document.getElementById('season-description');
    const paletteGrid = document.getElementById('palette-grid');

    let stream = null;

    // --- Season Data ---
    const seasons = {
        'Spring': {
            description: 'You have a warm, bright, and light coloring. You look best in fresh, vibrant colors like coral, peach, golden yellow, and lime green.',
            colors: ['#FFA07A', '#FFD700', '#98FB98', '#FF7F50', '#ADFF2F']
        },
        'Summer': {
            description: 'You have a cool, muted, and light coloring. You look best in soft, powdered colors like lavender, sky blue, sage green, and pastel pink.',
            colors: ['#E6E6FA', '#87CEEB', '#BC8F8F', '#DDA0DD', '#F08080']
        },
        'Autumn': {
            description: 'You have a warm, muted, and deep coloring. You look best in rich, earthy colors like olive green, terracotta, mustard yellow, and burnt orange.',
            colors: ['#556B2F', '#D2691E', '#B8860B', '#8B4513', '#CD853F']
        },
        'Winter': {
            description: 'You have a cool, bright, and deep coloring. You look best in stark, high-contrast colors like royal blue, emerald green, magenta, and pure white.',
            colors: ['#0000FF', '#004B49', '#FF00FF', '#FFFFFF', '#1A1A1A']
        }
    };

    // --- Camera Controls ---
    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user' }, 
                audio: false 
            });
            video.srcObject = stream;
            cameraBtn.innerHTML = '<span class="icon">⏹</span> Stop Camera';
            analyzeBtn.disabled = false;
            analyzeBtn.classList.add('pulse');
        } catch (err) {
            console.error('Error accessing camera:', err);
            alert('Could not access camera. Please check permissions or try uploading an image.');
        }
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            video.srcObject = null;
            stream = null;
            cameraBtn.innerHTML = '<span class="icon">📷</span> Start Camera';
            analyzeBtn.disabled = true;
            analyzeBtn.classList.remove('pulse');
        }
    }

    cameraBtn.addEventListener('click', () => {
        if (stream) {
            stopCamera();
        } else {
            startCamera();
        }
    });

    // --- Analysis Logic ---
    analyzeBtn.addEventListener('click', () => {
        if (!stream) return;

        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Sample color from the center area (reticle)
        const sampleSize = 20;
        const startX = Math.floor(canvas.width / 2) - (sampleSize / 2);
        const startY = Math.floor(canvas.height / 2) - (sampleSize / 2);
        
        const imageData = context.getImageData(startX, startY, sampleSize, sampleSize);
        const data = imageData.data;
        
        let r = 0, g = 0, b = 0;
        const totalPixels = sampleSize * sampleSize;
        
        for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i+1];
            b += data[i+2];
        }
        
        r = Math.floor(r / totalPixels);
        g = Math.floor(g / totalPixels);
        b = Math.floor(b / totalPixels);
        
        processColor(r, g, b);
    });

    // --- Image Upload Logic ---
    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const context = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                context.drawImage(img, 0, 0);
                
                // Sample center
                const sampleSize = 20;
                const startX = Math.floor(img.width / 2) - (sampleSize / 2);
                const startY = Math.floor(img.height / 2) - (sampleSize / 2);
                const imageData = context.getImageData(startX, startY, sampleSize, sampleSize);
                const data = imageData.data;
                
                let r = 0, g = 0, b = 0;
                for (let i = 0; i < data.length; i += 4) {
                    r += data[i];
                    g += data[i+1];
                    b += data[i+2];
                }
                r = Math.floor(r / (sampleSize * sampleSize));
                g = Math.floor(g / (sampleSize * sampleSize));
                b = Math.floor(b / (sampleSize * sampleSize));
                
                processColor(r, g, b);
                stopCamera(); // Stop live stream if active
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    // --- Color Processing & Mapping ---
    function processColor(r, g, b) {
        const hex = rgbToHex(r, g, b);
        const [h, s, l] = rgbToHsl(r, g, b);
        
        // Update UI
        sampledColorBox.style.backgroundColor = hex;
        colorHex.textContent = hex.toUpperCase();
        colorHsl.textContent = `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
        
        // Determine Season
        const season = determineSeason(h, s, l);
        mappedSeason.textContent = season;
        seasonDescription.textContent = seasons[season].description;
        
        // Generate Palette
        generatePalette(seasons[season].colors);
        
        // Switch View
        resultsPanel.classList.remove('initial-state');
        initialMessage.style.display = 'none';
        analysisContent.style.display = 'block';
    }

    function determineSeason(h, s, l) {
        // Broad skin tone heuristics
        // Warm/Cool distinction based on typical skin hue range (mostly 15-40)
        const isWarm = h >= 22 && h <= 50; 
        const isLight = l > 0.45;
        const isBright = s > 0.35;

        if (isWarm) {
            return isLight ? 'Spring' : 'Autumn';
        } else {
            return isLight ? 'Summer' : 'Winter';
        }
    }

    function generatePalette(colors) {
        paletteGrid.innerHTML = '';
        colors.forEach(color => {
            const item = document.createElement('div');
            item.className = 'palette-item';
            item.style.backgroundColor = color;
            item.title = color;
            paletteGrid.appendChild(item);
        });
    }

    // --- Helper Functions ---
    function rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    function rgbToHsl(r, g, b) {
        r /= 255, g /= 255, b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // achromatic
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return [h * 360, s, l];
    }
});
