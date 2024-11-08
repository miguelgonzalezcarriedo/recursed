class ImageEditor {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.image = null;
        this.originalSize = { width: 0, height: 0 };
        this.canvasSize = { width: 0, height: 0 };
        this.outputImage = null;
        this.enlargedImage = null;
        this.enlargedImageSize = { width: 0, height: 0 };
        this.frames = [];
        this.imageStackOnTop = true;
        this.scaleFactor = 1.0;
        this.zoomInPreview = document.getElementById('zoomInPreview');
        this.zoomOutPreview = document.getElementById('zoomOutPreview');
        this.zoomInCtx = this.zoomInPreview.getContext('2d');
        this.zoomOutCtx = this.zoomOutPreview.getContext('2d');
        this.previewTimeouts = { zoomIn: null, zoomOut: null };
        this.previewFrames = { zoomIn: [], zoomOut: [] };
        this.currentFrame = { zoomIn: 0, zoomOut: 0 };
        
        this.setupEventListeners();
        this.resizeCanvas();
        this.loadDefaultImage();
        this.applyRandomColors();
        this.adjustTitleFontSize();
        
        // Add resize listener for title adjustment
        window.addEventListener('resize', () => {
            this.adjustTitleFontSize();
        });
    }

    setupEventListeners() {
        // File input
        document.getElementById('imageInput').addEventListener('change', (e) => this.loadImage(e));
        
        // Buttons
        document.getElementById('saveImage').addEventListener('click', () => this.saveImage());
        document.getElementById('flipStack').addEventListener('click', () => this.flipStack());
        document.getElementById('zoomInApng').addEventListener('click', () => this.saveApng(true));
        document.getElementById('zoomOutApng').addEventListener('click', () => this.saveApng(false));
        document.getElementById('zoomInGif').addEventListener('click', () => this.saveGif(true));
        document.getElementById('zoomOutGif').addEventListener('click', () => this.saveGif(false));

        // Sliders
        ['boxScale', 'originX', 'originY'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.updateOutputImage());
        });

        // Window resize
        window.addEventListener('resize', () => this.resizeCanvas());

        // Update previews when sliders are released
        ['boxScale', 'originX', 'originY'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => this.updatePreviews());
        });

        document.getElementById('frameCount').addEventListener('change', () => this.updatePreviews());
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = 300; // Match the height used in CSS for previews

        if (this.image) {
            // Calculate size maintaining aspect ratio
            const imageAspect = this.originalSize.width / this.originalSize.height;
            const containerAspect = containerWidth / containerHeight;

            if (imageAspect > containerAspect) {
                // Image is wider than container
                this.canvas.width = containerWidth;
                this.canvas.height = containerWidth / imageAspect;
            } else {
                // Image is taller than container
                this.canvas.height = containerHeight;
                this.canvas.width = containerHeight * imageAspect;
            }
        } else {
            // No image loaded yet, use default size
            this.canvas.width = containerWidth;
            this.canvas.height = containerHeight;
        }

        this.canvasSize = {
            width: this.canvas.width,
            height: this.canvas.height
        };
        
        this.calculateScaleFactor();
        this.displayOutputImage();
    }

    loadDefaultImage() {
        this.loadImageFromUrl('default.png');
    }

    loadImageFromUrl(url) {
        const img = new Image();
        img.onload = () => {
            this.image = img;
            this.originalSize = {
                width: img.width,
                height: img.height
            };
            this.calculateScaleFactor();
            this.updateOutputImage();
            this.updatePreviews();
        };
        img.onerror = () => {
            console.error('Failed to load image:', url);
        };
        img.src = url;
    }

    loadImage(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.loadImageFromUrl(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    }

    calculateScaleFactor() {
        if (this.image) {
            const widthRatio = this.canvasSize.width / this.originalSize.width;
            const heightRatio = this.canvasSize.height / this.originalSize.height;
            this.scaleFactor = Math.min(widthRatio, heightRatio);
        }
    }

    updateOutputImage() {
        if (!this.image) return;

        // Create offscreen canvas for output image
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = this.originalSize.width;
        outputCanvas.height = this.originalSize.height;
        const outputCtx = outputCanvas.getContext('2d');

        const scale = parseFloat(document.getElementById('boxScale').value);
        const originX = parseFloat(document.getElementById('originX').value);
        const originY = parseFloat(document.getElementById('originY').value);

        // Clear canvas
        outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);

        let currentScale = 1.0;
        const downscaledImages = [];
        const upscaledImages = [];

        // Create scaled versions
        while (true) {
            if (this.originalSize.width * currentScale < 1 || 
                this.originalSize.height * currentScale < 1) {
                break;
            }

            // Calculate positions
            const originXPos = (this.originalSize.width - this.originalSize.width * currentScale) * originX;
            const originYPos = (this.originalSize.height - this.originalSize.height * currentScale) * originY;

            // Create temporary canvases for scaled images
            const downscaledCanvas = document.createElement('canvas');
            downscaledCanvas.width = this.originalSize.width * currentScale;
            downscaledCanvas.height = this.originalSize.height * currentScale;
            const downscaledCtx = downscaledCanvas.getContext('2d');

            // Draw scaled image
            downscaledCtx.drawImage(this.image, 0, 0, downscaledCanvas.width, downscaledCanvas.height);

            downscaledImages.push({
                canvas: downscaledCanvas,
                x: originXPos,
                y: originYPos
            });

            // Create upscaled version
            const upscaledCanvas = document.createElement('canvas');
            upscaledCanvas.width = this.originalSize.width;
            upscaledCanvas.height = this.originalSize.height;
            const upscaledCtx = upscaledCanvas.getContext('2d');

            const cropSize = {
                width: this.originalSize.width * currentScale,
                height: this.originalSize.height * currentScale
            };

            const cropX = (this.originalSize.width - cropSize.width) * originX;
            const cropY = (this.originalSize.height - cropSize.height) * originY;

            upscaledCtx.drawImage(
                this.image,
                cropX, cropY, cropSize.width, cropSize.height,
                0, 0, this.originalSize.width, this.originalSize.height
            );

            upscaledImages.unshift(upscaledCanvas);

            currentScale *= scale;
        }

        // Draw images in correct order
        if (this.imageStackOnTop) {
            upscaledImages.forEach(canvas => {
                outputCtx.drawImage(canvas, 0, 0);
            });
            downscaledImages.forEach(({canvas, x, y}) => {
                outputCtx.drawImage(canvas, x, y);
            });
        } else {
            downscaledImages.reverse().forEach(({canvas, x, y}) => {
                outputCtx.drawImage(canvas, x, y);
            });
            upscaledImages.reverse().forEach(canvas => {
                outputCtx.drawImage(canvas, 0, 0);
            });
        }

        this.outputImage = outputCanvas;
        this.displayOutputImage();
    }

    displayOutputImage() {
        if (!this.outputImage) return;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Calculate scale factor to fit while maintaining aspect ratio
        const scaleX = this.canvas.width / this.outputImage.width;
        const scaleY = this.canvas.height / this.outputImage.height;
        const scale = Math.min(scaleX, scaleY);

        // Calculate position to center the image
        const x = (this.canvas.width - this.outputImage.width * scale) / 2;
        const y = (this.canvas.height - this.outputImage.height * scale) / 2;

        // Draw scaled image
        this.ctx.drawImage(
            this.outputImage,
            x, y,
            this.outputImage.width * scale,
            this.outputImage.height * scale
        );
    }

    flipStack() {
        this.imageStackOnTop = !this.imageStackOnTop;
        this.updateOutputImage();
        // Add preview update
        this.updatePreviews();
    }

    saveImage() {
        if (!this.outputImage) return;

        const link = document.createElement('a');
        link.download = 'output.png';
        link.href = this.outputImage.toDataURL('image/png');
        link.click();
    }

    saveApng(zoomIn) {
        if (!this.createZoomFrames()) {
            console.log("No frames created. Cannot save APNG.");
            return;
        }

        // Convert frames to image data
        const frameList = zoomIn ? [...this.frames].reverse() : [...this.frames];
        const frameData = frameList.map(canvas => {
            const ctx = canvas.getContext('2d');
            // Create a new ImageData with a white background
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            return imgData.data;
        });

        // Create APNG
        const delays = new Array(frameData.length).fill(100); // 100ms delay for each frame
        const disposes = new Array(frameData.length).fill(2); // 2 = dispose to previous
        const blends = new Array(frameData.length).fill(0);   // 0 = source over
        const pngData = UPNG.encode(frameData, this.originalSize.width, this.originalSize.height, 0, delays, disposes, blends);

        // Save file
        const blob = new Blob([pngData], { type: 'image/png' });
        const link = document.createElement('a');
        link.download = 'animation.png';
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
    }

    saveGif(zoomIn) {
        if (!this.createZoomFrames()) {
            console.log("No frames created. Cannot save GIF.");
            return;
        }

        // Convert frames to image data
        const frameList = zoomIn ? [...this.frames].reverse() : [...this.frames];
        
        // Create GIF encoder
        const gif = new GIF({
            workers: 2,
            quality: 10,
            width: this.originalSize.width,
            height: this.originalSize.height,
            workerScript: 'gif.worker.js',
            transparent: 0x00000000,  // Fully transparent black
            dither: false            // Disable dithering to preserve exact colors
        });

        // Add each frame to the GIF
        frameList.forEach(canvas => {
            // Create a temporary canvas to handle transparency properly
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
            
            // Draw the frame
            tempCtx.drawImage(canvas, 0, 0);
            
            // Get image data
            const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // Fix transparency - make semi-transparent pixels fully opaque
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] > 0) {  // If pixel has any opacity
                    data[i + 3] = 255;   // Make it fully opaque
                }
            }
            
            // Put the modified image data back
            tempCtx.putImageData(imageData, 0, 0);
            
            // Add frame to GIF
            gif.addFrame(tempCanvas, {
                delay: 100,
                transparent: true,
                dispose: 2  // Restore to background color
            });
        });

        // Render the GIF
        gif.on('finished', blob => {
            const link = document.createElement('a');
            link.download = 'animation.gif';
            link.href = URL.createObjectURL(blob);
            link.click();
            URL.revokeObjectURL(link.href);
        });

        gif.render();
    }

    resizeImage() {
        if (!this.outputImage) {
            console.log("No output image available to resize.");
            return;
        }

        // Clear previous output
        this.enlargedImage = null;
        this.enlargedImageSize = { width: 0, height: 0 };
        this.enlargedOriginX = 0;
        this.enlargedOriginY = 0;

        // Get scale value
        const scale = parseFloat(document.getElementById('boxScale').value);
        const inverseScale = 1.0 / scale;
        const originX = parseFloat(document.getElementById('originX').value);
        const originY = parseFloat(document.getElementById('originY').value);

        // Create enlarged canvas
        const enlargedCanvas = document.createElement('canvas');
        enlargedCanvas.width = Math.round(this.originalSize.width * inverseScale);
        enlargedCanvas.height = Math.round(this.originalSize.height * inverseScale);
        this.enlargedImageSize = {
            width: enlargedCanvas.width,
            height: enlargedCanvas.height
        };

        // Draw output image onto enlarged canvas
        const enlargedCtx = enlargedCanvas.getContext('2d');
        enlargedCtx.imageSmoothingEnabled = true;
        enlargedCtx.imageSmoothingQuality = 'high';

        // Calculate new origin coordinates
        this.enlargedOriginX = (this.enlargedImageSize.width * originX) - (this.originalSize.width * originX);
        this.enlargedOriginY = (this.enlargedImageSize.height * originY) - (this.originalSize.height * originY);
        console.log(`Enlarged Origin Coordinates: (${this.enlargedOriginX}, ${this.enlargedOriginY})`);

        if (this.imageStackOnTop) {
            // First, draw the enlarged version of the output image
            enlargedCtx.drawImage(
                this.outputImage, 
                0, 0, 
                this.originalSize.width, 
                this.originalSize.height,
                0, 0,
                this.enlargedImageSize.width,
                this.enlargedImageSize.height
            );

            // Then paste the original output image at the calculated origin
            enlargedCtx.drawImage(
                this.outputImage,
                Math.round(this.enlargedOriginX),
                Math.round(this.enlargedOriginY)
            );
        } else {
            // For stack on bottom, first draw the enlarged output
            enlargedCtx.drawImage(
                this.outputImage, 
                0, 0, 
                this.originalSize.width, 
                this.originalSize.height,
                0, 0,
                this.enlargedImageSize.width,
                this.enlargedImageSize.height
            );

            // Create a temporary canvas for the original size image
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.enlargedImageSize.width;
            tempCanvas.height = this.enlargedImageSize.height;
            const tempCtx = tempCanvas.getContext('2d');

            // Draw the output image at the origin position
            tempCtx.drawImage(
                this.outputImage,
                Math.round(this.enlargedOriginX),
                Math.round(this.enlargedOriginY)
            );

            // Draw the temp canvas on top
            enlargedCtx.drawImage(tempCanvas, 0, 0);
        }

        this.enlargedImage = enlargedCanvas;
    }

    createZoomFrames() {
        // Clear previous frames
        this.frames = [];

        // Call resize_image
        this.resizeImage();
        console.log("Resized image created for animation.");
        
        if (!this.enlargedImage) {
            console.log("No enlarged image available to create animation.");
            return;
        }

        // Get parameters
        const scale = parseFloat(document.getElementById('boxScale').value);
        const originX = parseFloat(document.getElementById('originX').value);
        const originY = parseFloat(document.getElementById('originY').value);
        const frameCount = parseInt(document.getElementById('frameCount').value);

        // Calculate scales
        const startScale = 1.0;
        const endScale = this.enlargedImageSize.width / this.originalSize.width;

        // Create frames
        for (let i = 0; i < frameCount; i++) {
            const t = i / frameCount;
            const currentScale = startScale * Math.exp(t * Math.log(endScale / startScale));

            // Calculate frame size
            const frameSize = {
                width: this.originalSize.width * currentScale,
                height: this.originalSize.height * currentScale
            };

            // Skip invalid frames
            if (frameSize.width <= 0 || frameSize.height <= 0 ||
                frameSize.width > this.enlargedImageSize.width ||
                frameSize.height > this.enlargedImageSize.height) {
                console.log(`Frame ${i} - Invalid frame size: ${frameSize.width}x${frameSize.height}. Skipping frame.`);
                continue;
            }

            // Calculate crop coordinates
            const cropX = (this.enlargedImageSize.width - frameSize.width) * originX;
            const cropY = (this.enlargedImageSize.height - frameSize.height) * originY;

            // Create frame canvas
            const frameCanvas = document.createElement('canvas');
            frameCanvas.width = this.originalSize.width;
            frameCanvas.height = this.originalSize.height;
            const frameCtx = frameCanvas.getContext('2d');

            // Draw cropped and scaled portion
            frameCtx.drawImage(
                this.enlargedImage,
                cropX, cropY, frameSize.width, frameSize.height,
                0, 0, this.originalSize.width, this.originalSize.height
            );

            this.frames.push(frameCanvas);
        }

        if (this.frames.length > 0) {
            this.createFavicon(); // Add this line
        }
        
        return this.frames.length > 0;
    }

    updatePreviews() {
        this.createAndDisplayPreview(true);  // Zoom In
        this.createAndDisplayPreview(false); // Zoom Out
    }

    createAndDisplayPreview(zoomIn) {
        const previewType = zoomIn ? 'zoomIn' : 'zoomOut';
        const ctx = zoomIn ? this.zoomInCtx : this.zoomOutCtx;
        const canvas = zoomIn ? this.zoomInPreview : this.zoomOutPreview;

        // Clear existing animation
        if (this.previewTimeouts[previewType]) {
            clearTimeout(this.previewTimeouts[previewType]);
        }

        // Create frames
        if (!this.createZoomFrames()) {
            console.log(`No frames created for ${previewType} preview.`);
            return;
        }

        // Store frames and set up animation
        this.previewFrames[previewType] = zoomIn ? [...this.frames].reverse() : [...this.frames];
        this.currentFrame[previewType] = 0;

        // Set canvas size to maintain aspect ratio
        const containerWidth = canvas.parentElement.clientWidth;
        const containerHeight = canvas.parentElement.clientHeight;
        const imageAspect = this.originalSize.width / this.originalSize.height;
        const containerAspect = containerWidth / containerHeight;

        if (imageAspect > containerAspect) {
            // Image is wider than container
            canvas.width = containerWidth;
            canvas.height = containerWidth / imageAspect;
        } else {
            // Image is taller than container
            canvas.height = containerHeight;
            canvas.width = containerHeight * imageAspect;
        }

        // Start animation
        const animate = () => {
            const frames = this.previewFrames[previewType];
            const currentFrameIndex = this.currentFrame[previewType];

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw current frame
            ctx.drawImage(frames[currentFrameIndex], 0, 0, canvas.width, canvas.height);

            // Update frame index
            this.currentFrame[previewType] = (currentFrameIndex + 1) % frames.length;

            // Schedule next frame
            this.previewTimeouts[previewType] = setTimeout(animate, 100);
        };

        // Start animation
        animate();
    }

    // Add this method to the ImageEditor class
    createFavicon() {
        if (!this.frames || this.frames.length === 0) return;

        // Create a small canvas for the favicon (typically 32x32)
        const faviconSize = 32;
        const faviconCanvas = document.createElement('canvas');
        faviconCanvas.width = faviconSize;
        faviconCanvas.height = faviconSize;
        const ctx = faviconCanvas.getContext('2d');

        // Scale and draw each frame
        const frameList = [...this.frames];
        const frameData = frameList.map(canvas => {
            ctx.clearRect(0, 0, faviconSize, faviconSize);
            ctx.drawImage(canvas, 0, 0, faviconSize, faviconSize);
            return ctx.getImageData(0, 0, faviconSize, faviconSize).data;
        });

        // Create APNG with dispose:1 to clear previous frame
        const delays = new Array(frameData.length).fill(100);
        const disposes = new Array(frameData.length).fill(1);
        const pngData = UPNG.encode(frameData, faviconSize, faviconSize, 0, delays, null, disposes);

        // Create blob and update favicon
        const blob = new Blob([pngData], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        const link = document.querySelector("link[rel*='icon']");
        if (link) {
            link.href = url;
        }
    }

    // Add this method to the ImageEditor class
    applyRandomColors() {
        const getRandomLightColor = () => {
            const r = Math.floor(Math.random() * 156 + 100);
            const g = Math.floor(Math.random() * 156 + 100);
            const b = Math.floor(Math.random() * 156 + 100);
            return `rgb(${r}, ${g}, ${b})`;
        };

        const getRandomDarkColor = () => {
            const r = Math.floor(Math.random() * 100);
            const g = Math.floor(Math.random() * 100);
            const b = Math.floor(Math.random() * 100);
            return `rgb(${r}, ${g}, ${b})`;
        };

        // Apply colors to main elements
        document.body.style.backgroundColor = getRandomLightColor();
        
        // Header/title section
        const titleSection = document.querySelector('.title-section');
        titleSection.style.backgroundColor = getRandomLightColor();
        titleSection.style.borderColor = getRandomDarkColor();
        
        // Controls and preview sections
        document.querySelectorAll('.controls, .preview').forEach(element => {
            element.style.backgroundColor = getRandomLightColor();
            element.style.borderColor = getRandomDarkColor();
        });
        
        // Upload section
        const uploadSection = document.querySelector('.upload-section');
        uploadSection.style.backgroundColor = getRandomLightColor();
        uploadSection.style.borderColor = getRandomDarkColor();
        
        // Footer
        const footer = document.querySelector('.footer');
        footer.style.backgroundColor = getRandomLightColor();
        footer.style.borderColor = getRandomDarkColor();

        // Add random dark colors for all buttons
        document.querySelectorAll('button').forEach(button => {
            button.style.borderColor = getRandomDarkColor();
        });
    }

    // Add this new method
    adjustTitleFontSize() {
        const title = document.querySelector('.title-section h1');
        const titleSection = document.querySelector('.title-section');
        
        // Reset font size to original
        title.style.fontSize = '3.5em';
        
        // Check if title overflows
        while (title.offsetWidth > titleSection.offsetWidth - 40) { // 40px for padding
            const currentSize = parseFloat(window.getComputedStyle(title).fontSize);
            title.style.fontSize = (currentSize - 1) + 'px';
            
            // Safety check to prevent infinite loop
            if (currentSize <= 12) break; // Minimum font size
        }
    }
}

// Initialize the editor when the page loads
window.addEventListener('load', () => {
    new ImageEditor();
});
