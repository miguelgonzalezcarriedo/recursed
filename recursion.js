// Using UPNG.js for PNG encoding/decoding
// Using GIF.js for GIF creation

// Add these helper functions for complex number operations at the top of the file
const complex = {
    create: (re, im = 0) => ({ re, im }),
    
    multiply: (a, b) => ({
        re: a.re * b.re - a.im * b.im,
        im: a.re * b.im + a.im * b.re
    }),
    
    add: (a, b) => ({
        re: a.re + b.re,
        im: a.im + b.im
    }),
    
    scale: (a, s) => ({
        re: a.re * s,
        im: a.im * s
    })
};

// Add this helper function at the top with the other helpers
const numeric_helpers = {
    getCol: (matrix, col) => {
        return matrix.map(row => row[col]);
    },
    
    // Helper to create a complex matrix
    complexMatrix: (real, imag) => {
        return real.map((row, i) => 
            row.map((val, j) => ({
                re: val,
                im: imag ? imag[i][j] : 0
            }))
        );
    }
};

class ImageEditor {
    constructor() {
        this.image = null;
        this.originalSize = [0, 0];
        this.canvas = null;
        this.outputImage = null;
        this.frames = [];
        this.imageStackOnTop = true;
        this.canvasSize = [0, 0];
        this.transformationCorners = [];
        this.selectedCorner = null;
        this.isDragging = false;

        // Initialize UI
        this.setupUI();
        
        // Bind canvas click event
        this.canvas.addEventListener('click', this.onCanvasClick.bind(this));
        
        // Load default image
        this.loadDefaultImage();

        // Set favicon
        const favicon = document.createElement('link');
        favicon.rel = 'icon';
        favicon.type = 'image/png';
        favicon.href = 'transformed_image.png';
        document.head.appendChild(favicon);
    }

    setupUI() {
        // Find the app container
        this.container = document.getElementById('app');

        // Controls frame
        const controlsFrame = document.createElement('div');
        controlsFrame.className = 'controls-frame';
        this.container.appendChild(controlsFrame);

        // Load Image Button
        const loadButton = document.createElement('button');
        loadButton.textContent = 'Load Image';
        loadButton.onclick = () => this.loadImage();
        controlsFrame.appendChild(loadButton);

        // Save Image Button
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save Image';
        saveButton.onclick = () => this.saveImage();
        controlsFrame.appendChild(saveButton);

        // Flip Stack Button
        const flipStackButton = document.createElement('button');
        flipStackButton.textContent = 'Flip Stack';
        flipStackButton.onclick = () => this.flipStack();
        controlsFrame.appendChild(flipStackButton);

        // Frame count input with label
        const frameCountContainer = document.createElement('div');
        frameCountContainer.className = 'frame-count-container';
        controlsFrame.appendChild(frameCountContainer);

        const frameCountLabel = document.createElement('label');
        frameCountLabel.textContent = 'Frames:';
        frameCountLabel.htmlFor = 'frameCount';
        frameCountContainer.appendChild(frameCountLabel);

        this.frameCountInput = document.createElement('input');
        this.frameCountInput.type = 'text';
        this.frameCountInput.id = 'frameCount';
        this.frameCountInput.value = '15';
        this.frameCountInput.style.width = '50px';
        frameCountContainer.appendChild(this.frameCountInput);

        // Create main content container
        const mainContent = document.createElement('div');
        mainContent.className = 'main-content';
        this.container.appendChild(mainContent);

        // Create left previews container
        const leftPreviewsContainer = document.createElement('div');
        leftPreviewsContainer.className = 'previews-container';
        mainContent.appendChild(leftPreviewsContainer);

        // Zoom In Preview
        const zoomInContainer = document.createElement('div');
        zoomInContainer.className = 'preview-container';
        leftPreviewsContainer.appendChild(zoomInContainer);

        this.zoomInCanvas = document.createElement('canvas');
        this.zoomInCanvas.className = 'preview-canvas';
        zoomInContainer.appendChild(this.zoomInCanvas);

        // Zoom In buttons container
        const zoomInButtons = document.createElement('div');
        zoomInButtons.className = 'preview-buttons';
        zoomInContainer.appendChild(zoomInButtons);

        // Zoom In APNG Button
        const zoomInApngButton = document.createElement('button');
        zoomInApngButton.textContent = 'Save as APNG';
        zoomInApngButton.onclick = () => this.saveApng(true);
        zoomInButtons.appendChild(zoomInApngButton);

        // Zoom In GIF Button
        const zoomInGifButton = document.createElement('button');
        zoomInGifButton.textContent = 'Save as GIF';
        zoomInGifButton.onclick = () => this.saveGif(true);
        zoomInButtons.appendChild(zoomInGifButton);

        // Canvas container
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'canvas-container';
        mainContent.appendChild(canvasContainer);

        // Canvas
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'main-canvas';
        canvasContainer.appendChild(this.canvas);

        // Create right previews container
        const rightPreviewsContainer = document.createElement('div');
        rightPreviewsContainer.className = 'previews-container';
        mainContent.appendChild(rightPreviewsContainer);

        // Zoom Out Preview
        const zoomOutContainer = document.createElement('div');
        zoomOutContainer.className = 'preview-container';
        rightPreviewsContainer.appendChild(zoomOutContainer);

        this.zoomOutCanvas = document.createElement('canvas');
        this.zoomOutCanvas.className = 'preview-canvas';
        zoomOutContainer.appendChild(this.zoomOutCanvas);

        // Zoom Out buttons container
        const zoomOutButtons = document.createElement('div');
        zoomOutButtons.className = 'preview-buttons';
        zoomOutContainer.appendChild(zoomOutButtons);

        // Zoom Out APNG Button
        const zoomOutApngButton = document.createElement('button');
        zoomOutApngButton.textContent = 'Save as APNG';
        zoomOutApngButton.onclick = () => this.saveApng(false);
        zoomOutButtons.appendChild(zoomOutApngButton);

        // Zoom Out GIF Button
        const zoomOutGifButton = document.createElement('button');
        zoomOutGifButton.textContent = 'Save as GIF';
        zoomOutGifButton.onclick = () => this.saveGif(false);
        zoomOutButtons.appendChild(zoomOutGifButton);

        // Initial canvas size
        this.canvas.width = 800;
        this.canvas.height = 600;
        this.canvasSize = [800, 600];

        // Bind resize event
        window.addEventListener('resize', () => this.onCanvasResize());

        // Add drag handlers
        this.setupDragHandlers();
    }

    // Mathematical functions translated exactly from Python
    findCoeffs(fromCorners, toCorners) {
        // Create matrix A for the equation system
        const A = [];
        for (let i = 0; i < 4; i++) {
            const [x, y] = fromCorners[i];
            const [u, v] = toCorners[i];
            A.push([x, y, 1, 0, 0, 0, -u*x, -u*y]);
            A.push([0, 0, 0, x, y, 1, -v*x, -v*y]);
        }

        // Create vector b
        const b = toCorners.flatMap(([x, y]) => [x, y]);

        // Solve the equation system using numeric.js
        const AT = numeric.transpose(A);
        const ATA = numeric.dot(AT, A);
        const ATb = numeric.dot(AT, b);
        const h = numeric.solve(ATA, ATb);

        // Return coefficients array
        return [...h, 1];  // Add the last coefficient which is always 1
    }

    calculateIterationCorners() {
        this.contractingCornerSets = [];
        this.expandingCornerSets = [];

        if (this.transformationCorners.length < 4) {
            console.log('Not enough corners for transformation.');
            return [[], []];
        }

        // Get original corners
        const [width, height] = this.originalSize;
        const originalCorners = [[0, 0], [width, 0], [width, height], [0, height]];

        // Sort transformation corners to match original corners order
        const sortedTransformCorners = this.sortCorners(this.transformationCorners);

        // Get transformation coefficients
        const H = this.findCoeffs(originalCorners, sortedTransformCorners);
        const Hinv = this.findCoeffs(sortedTransformCorners, originalCorners);

        console.log('Transformation Coefficients:', H);
        console.log('Inverse Transformation Coefficients:', Hinv);

        // Helper function to apply transformation
        const applyTransform = (corners, coeffs) => {
            return corners.map(([x, y]) => {
                const w = coeffs[6] * x + coeffs[7] * y + coeffs[8];
                const xNew = (coeffs[0] * x + coeffs[1] * y + coeffs[2]) / w;
                const yNew = (coeffs[3] * x + coeffs[4] * y + coeffs[5]) / w;
                return [xNew, yNew];
            });
        };

        // Helper function to calculate minimum distance between corners
        const minDistance = (corners) => {
            let minDist = Infinity;
            for (let i = 0; i < 4; i++) {
                for (let j = i + 1; j < 4; j++) {
                    const [x1, y1] = corners[i];
                    const [x2, y2] = corners[j];
                    const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
                    minDist = Math.min(minDist, dist);
                }
            }
            return minDist;
        };

        // Start with original corners for both directions
        let contractingCorners = originalCorners;
        let expandingCorners = originalCorners;

        // Changed: Iterate a fixed number of times or until minimum distance threshold
        const maxIterations = 50;  // Increased from 20 to 50
        const minDistanceThreshold = 1;

        for (let i = 0; i < maxIterations; i++) {
            // Apply transformations
            const nextContracting = applyTransform(contractingCorners, H);
            const nextExpanding = applyTransform(expandingCorners, Hinv);

            console.log(`Iteration ${i + 1}:`);
            console.log('Contracting Corners:', nextContracting);
            console.log('Expanding Corners:', nextExpanding);

            // Check minimum distance for contracting corners
            if (minDistance(nextContracting) < minDistanceThreshold) {
                console.log('Minimum distance threshold reached. Stopping iterations.');
                break;
            }

            // Add to corner sets
            this.contractingCornerSets.push(nextContracting);
            this.expandingCornerSets.push(nextExpanding);

            // Update for next iteration
            contractingCorners = nextContracting;
            expandingCorners = nextExpanding;
        }

        return [this.contractingCornerSets, this.expandingCornerSets];
    }

    createTransformedCopies() {
        const [width, height] = this.originalSize;
        const originalCorners = [[0, 0], [width, 0], [width, height], [0, height]];
        const transformedImages = [];

        console.log('Creating transformed copies...');

        // Create base canvas from original image
        const baseCanvas = document.createElement('canvas');
        baseCanvas.width = width;
        baseCanvas.height = height;
        const baseCtx = baseCanvas.getContext('2d');
        baseCtx.drawImage(this.image, 0, 0);
        const baseImageData = baseCtx.getImageData(0, 0, width, height);

        // Create expanding transformations (from largest to smallest)
        for (const expandingCorners of [...this.expandingCornerSets].reverse()) {
            const coeffs = this.findCoeffs(originalCorners, expandingCorners);
            console.log('Expanding Coefficients:', coeffs);
            
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            const imageData = ctx.createImageData(width, height);
            
            // Apply perspective transform pixel by pixel
            for(let y = 0; y < height; y++) {
                for(let x = 0; x < width; x++) {
                    // Calculate source coordinates using perspective transform
                    const w = coeffs[6]*x + coeffs[7]*y + coeffs[8];
                    const srcX = Math.round((coeffs[0]*x + coeffs[1]*y + coeffs[2])/w);
                    const srcY = Math.round((coeffs[3]*x + coeffs[4]*y + coeffs[5])/w);
                    
                    // If source pixel is within bounds, copy it
                    if(srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
                        const srcIdx = (srcY * width + srcX) * 4;
                        const dstIdx = (y * width + x) * 4;
                        
                        imageData.data[dstIdx] = baseImageData.data[srcIdx];
                        imageData.data[dstIdx + 1] = baseImageData.data[srcIdx + 1];
                        imageData.data[dstIdx + 2] = baseImageData.data[srcIdx + 2];
                        imageData.data[dstIdx + 3] = baseImageData.data[srcIdx + 3];
                    }
                }
            }
            
            ctx.putImageData(imageData, 0, 0);
            transformedImages.push(canvas);
        }

        // Add original image in the middle
        transformedImages.push(baseCanvas);

        // Create contracting transformations (from largest to smallest)
        for (const contractingCorners of this.contractingCornerSets) {
            const coeffs = this.findCoeffs(originalCorners, contractingCorners);
            console.log('Contracting Coefficients:', coeffs);
            
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            const imageData = ctx.createImageData(width, height);
            
            // Apply perspective transform pixel by pixel
            for(let y = 0; y < height; y++) {
                for(let x = 0; x < width; x++) {
                    // Calculate source coordinates using perspective transform
                    const w = coeffs[6]*x + coeffs[7]*y + coeffs[8];
                    const srcX = Math.round((coeffs[0]*x + coeffs[1]*y + coeffs[2])/w);
                    const srcY = Math.round((coeffs[3]*x + coeffs[4]*y + coeffs[5])/w);
                    
                    // If source pixel is within bounds, copy it
                    if(srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
                        const srcIdx = (srcY * width + srcX) * 4;
                        const dstIdx = (y * width + x) * 4;
                        
                        imageData.data[dstIdx] = baseImageData.data[srcIdx];
                        imageData.data[dstIdx + 1] = baseImageData.data[srcIdx + 1];
                        imageData.data[dstIdx + 2] = baseImageData.data[srcIdx + 2];
                        imageData.data[dstIdx + 3] = baseImageData.data[srcIdx + 3];
                    }
                }
            }
            
            ctx.putImageData(imageData, 0, 0);
            transformedImages.push(canvas);
        }

        console.log('Total transformed images created:', transformedImages.length);
        return transformedImages;
    }

    stackTransformedImages(transformedImages) {
        const [width, height] = this.originalSize;
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = width;
        outputCanvas.height = height;
        const ctx = outputCanvas.getContext('2d');
        
        // Clear canvas with transparent background
        ctx.clearRect(0, 0, width, height);

        if (!this.imageStackOnTop) {
            // Stack from bottom to top (like Python's paste order)
            for (const img of transformedImages) {
                ctx.drawImage(img, 0, 0);
            }
        } else {
            // Stack from top to bottom (like Python's reversed paste order)
            for (const img of [...transformedImages].reverse()) {
                ctx.drawImage(img, 0, 0);
            }
        }
        
        // Store both the canvas and its context for later use
        this.outputImage = {
            canvas: outputCanvas,
            ctx: ctx
        };
    }

    loadImage(event = null) {
        // Create file input element
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';  // Accept all image types
        
        const loadImageFile = (file) => {
            if (!file.type.match('image.*')) {
                alert('Please select an image file.');
                return;
            }

            // Clear frames and transformation corners
            this.frames = [];
            this.transformationCorners = [];

            // Load the image
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    // Calculate new dimensions (max 1200px on longest side)
                    const MAX_SIZE = 1200;
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > MAX_SIZE || height > MAX_SIZE) {
                        if (width > height) {
                            height = Math.round((height * MAX_SIZE) / width);
                            width = MAX_SIZE;
                        } else {
                            width = Math.round((width * MAX_SIZE) / height);
                            height = MAX_SIZE;
                        }
                    }

                    // Create resizing canvas
                    const conversionCanvas = document.createElement('canvas');
                    conversionCanvas.width = width;
                    conversionCanvas.height = height;
                    const ctx = conversionCanvas.getContext('2d');
                    
                    // Enable image smoothing for better quality
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    
                    // Draw and resize image
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to PNG data URL
                    conversionCanvas.toBlob((blob) => {
                        const pngUrl = URL.createObjectURL(blob);
                        const pngImage = new Image();
                        pngImage.onload = () => {
                            this.image = pngImage;
                            this.originalSize = [width, height];
                    
                            // Create initial canvas from loaded image
                            const initialCanvas = document.createElement('canvas');
                            initialCanvas.width = width;
                            initialCanvas.height = height;
                            const ctx = initialCanvas.getContext('2d');
                            ctx.drawImage(pngImage, 0, 0);
                            this.outputImage = {
                                canvas: initialCanvas,
                                ctx: ctx
                            };

                            // Set default transformation corners based on image size
                            const padding = 20;
                            const cornerSize = Math.min(width, height) * 0.3;
                            const centerX = width / 2;
                            const centerY = height / 2;
                            
                            this.transformationCorners = [
                                [centerX - cornerSize + padding, centerY - cornerSize + padding],
                                [centerX + cornerSize - padding, centerY - cornerSize + padding],
                                [centerX + cornerSize - padding, centerY + cornerSize - padding],
                                [centerX - cornerSize + padding, centerY + cornerSize - padding]
                            ];
                    
                            this.updateOutputImage();
                            
                            // Add canvas resize handler after image is loaded
                            window.addEventListener('resize', () => this.onCanvasResize());
                            this.onCanvasResize();

                            // Remove the upload text if it exists
                            const uploadText = this.canvas.parentElement.querySelector('.upload-text');
                            if (uploadText) {
                                uploadText.remove();
                            }

                            // Clean up the temporary URL
                            URL.revokeObjectURL(pngUrl);
                        };
                        pngImage.onerror = () => {
                            alert('Error converting image to PNG format.');
                            URL.revokeObjectURL(pngUrl);
                        };
                        pngImage.src = pngUrl;
                    }, 'image/png', 1.0);
                };
                img.onerror = () => {
                    alert('Error loading image. Please try another file.');
                };
                img.src = event.target.result;
            };
            reader.onerror = () => {
                alert('Error reading file. Please try again.');
            };
            reader.readAsDataURL(file);
        };

        // Handle file input change
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                // Show loading text
                const uploadText = this.canvas.parentElement.querySelector('.upload-text');
                if (uploadText) {
                    uploadText.textContent = 'Converting image...';
                    uploadText.classList.add('loading');
                }
                loadImageFile(file);
            }
        };

        // Add drag and drop support to canvas container
        const canvasContainer = this.canvas.parentElement;
        
        // Only set up drag and drop if we haven't already
        if (!canvasContainer.hasAttribute('data-drag-initialized')) {
            canvasContainer.setAttribute('data-drag-initialized', 'true');
            
            canvasContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                canvasContainer.classList.add('drag-over');
            });

            canvasContainer.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                canvasContainer.classList.remove('drag-over');
            });

            canvasContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                canvasContainer.classList.remove('drag-over');

                const file = e.dataTransfer.files[0];
                if (file) {
                    // Show loading text
                    const uploadText = this.canvas.parentElement.querySelector('.upload-text');
                    if (uploadText) {
                        uploadText.textContent = 'Converting image...';
                        uploadText.classList.add('loading');
                    }
                    loadImageFile(file);
                }
            });

            // Add upload text if no image is loaded
            if (!this.image) {
                const uploadText = document.createElement('div');
                uploadText.className = 'upload-text';
                uploadText.innerHTML = 'Drag image here';
                canvasContainer.appendChild(uploadText);
            }
        }

        // If triggered by button or initial load, open file dialog
        if (!event || (event.target && event.target.tagName === 'BUTTON')) {
            input.click();
        }
    }

    saveImage() {
        if (!this.outputImage) {
            console.log("No output image available to save.");
            return;
        }

        try {
            // Convert canvas to blob
            this.outputImage.canvas.toBlob((blob) => {  // Use the canvas property
                // Create download link
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'transformed_image.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(a.href);
            }, 'image/png');
        } catch (e) {
            console.log("Error saving image:", e);
        }
    }

    // Helper function to sort corners in clockwise order starting from top-left
    sortCorners(corners) {
        // Find center point
        const center = corners.reduce(
            ([sumX, sumY], [x, y]) => [sumX + x/4, sumY + y/4],
            [0, 0]
        );

        // Sort corners based on angle from center
        return corners.slice().sort((a, b) => {
            const angleA = Math.atan2(a[1] - center[1], a[0] - center[0]);
            const angleB = Math.atan2(b[1] - center[1], b[0] - center[0]);
            return angleA - angleB;
        });
    }

    createZoomFrames() {
        this.frames = [];

        if (!this.image || this.transformationCorners.length < 4) {
            return;
        }

        try {
            const numFrames = parseInt(this.frameCountInput.value) || 15;
            const [width, height] = this.originalSize;
            const originalCorners = [[0, 0], [width, 0], [width, height], [0, height]];

            // Sort transformation corners to match original corners order
            const sortedTransformCorners = this.sortCorners(this.transformationCorners);

            // Get coefficients for both directions
            const forwardCoeffs = this.findCoeffs(originalCorners, sortedTransformCorners);
            const reverseCoeffs = this.findCoeffs(sortedTransformCorners, originalCorners);

            // Convert coefficients to 3x3 homography matrices
            const H_forward = [
                [forwardCoeffs[0], forwardCoeffs[1], forwardCoeffs[2]],
                [forwardCoeffs[3], forwardCoeffs[4], forwardCoeffs[5]],
                [forwardCoeffs[6], forwardCoeffs[7], 1.0]
            ];

            const H_reverse = [
                [reverseCoeffs[0], reverseCoeffs[1], reverseCoeffs[2]],
                [reverseCoeffs[3], reverseCoeffs[4], reverseCoeffs[5]],
                [reverseCoeffs[6], reverseCoeffs[7], 1.0]
            ];

            // Calculate eigendecompositions
            const forwardEig = numeric.eig(H_forward);
            const reverseEig = numeric.eig(H_reverse);

            // Helper function to calculate stable nth root of complex number
            const stableNthRoot = (re, im, n, k) => {
                const r = Math.sqrt(re * re + im * im);
                let theta = Math.atan2(im, re);
                if (theta > Math.PI) theta -= 2 * Math.PI;
                else if (theta < -Math.PI) theta += 2 * Math.PI;
                const rootR = Math.pow(r, k/n);
                const rootTheta = (theta * k) / n;
                return {
                    re: rootR * Math.cos(rootTheta),
                    im: rootR * Math.sin(rootTheta)
                };
            };

            // First frame is the output image
            const firstFrame = document.createElement('canvas');
            firstFrame.width = width;
            firstFrame.height = height;
            const firstCtx = firstFrame.getContext('2d');
            firstCtx.drawImage(this.outputImage.canvas, 0, 0);
            this.frames.push(firstFrame);

            const forwardFrames = [];
            const reverseFrames = [];

            // For each frame, create both transformations
            for (let k = 1; k < numFrames; k++) {
                // Forward transformation
                const powerK = forwardEig.lambda.x.map((re, i) => {
                    const im = forwardEig.lambda.y ? forwardEig.lambda.y[i] : 0;
                    return stableNthRoot(re, im, numFrames, k);
                });

                // Sort eigenvalues by magnitude
                const magnitudes = powerK.map(z => Math.sqrt(z.re * z.re + z.im * z.im));
                const indices = magnitudes.map((_, i) => i).sort((a, b) => magnitudes[a] - magnitudes[b]);
                
                // Sort eigenvalues and eigenvectors
                const sortedPowerK = indices.map(i => powerK[i]);
                const sortedEigenvectors = numeric.transpose(indices.map(i => forwardEig.E.x.map(row => row[i])));

                // Create diagonal matrix with complex eigenvalues
                const D = numeric.rep([3, 3], 0);
                for (let i = 0; i < 3; i++) {
                    D[i][i] = sortedPowerK[i].re;
                }

                // Calculate transformation matrix
                const Vinv = numeric.inv(sortedEigenvectors);
                let H = numeric.dot(numeric.dot(sortedEigenvectors, D), Vinv);
                
                // Take real part and normalize
                H = H.map(row => row.map(x => typeof x === 'object' ? x.re : x));
                const scale = H[2][2];
                H = H.map(row => row.map(x => x / scale));

                const coeffs = [
                    H[0][0], H[0][1], H[0][2],
                    H[1][0], H[1][1], H[1][2],
                    H[2][0], H[2][1]
                ];

                // Reverse transformation
                const reversePowerK = reverseEig.lambda.x.map((re, i) => {
                    const im = reverseEig.lambda.y ? reverseEig.lambda.y[i] : 0;
                    return stableNthRoot(re, im, numFrames, k);
                });

                const reverseMagnitudes = reversePowerK.map(z => Math.sqrt(z.re * z.re + z.im * z.im));
                const reverseIndices = reverseMagnitudes.map((_, i) => i).sort((a, b) => reverseMagnitudes[a] - reverseMagnitudes[b]);
                
                const sortedReversePowerK = reverseIndices.map(i => reversePowerK[i]);
                const sortedReverseEigenvectors = numeric.transpose(reverseIndices.map(i => reverseEig.E.x.map(row => row[i])));

                const reverseD = numeric.rep([3, 3], 0);
                for (let i = 0; i < 3; i++) {
                    reverseD[i][i] = sortedReversePowerK[i].re;
                }

                const reverseVinv = numeric.inv(sortedReverseEigenvectors);
                let reverseH = numeric.dot(numeric.dot(sortedReverseEigenvectors, reverseD), reverseVinv);
                
                reverseH = reverseH.map(row => row.map(x => typeof x === 'object' ? x.re : x));
                const reverseScale = reverseH[2][2];
                reverseH = reverseH.map(row => row.map(x => x / reverseScale));

                const rCoeffs = [
                    reverseH[0][0], reverseH[0][1], reverseH[0][2],
                    reverseH[1][0], reverseH[1][1], reverseH[1][2],
                    reverseH[2][0], reverseH[2][1]
                ];

                // Create transformed images
                const forwardCanvas = document.createElement('canvas');
                forwardCanvas.width = width;
                forwardCanvas.height = height;
                const forwardCtx = forwardCanvas.getContext('2d');
                const forwardTransformed = this.transformImage(this.outputImage.canvas, coeffs);
                forwardCtx.drawImage(forwardTransformed, 0, 0);
                forwardFrames.push(forwardCanvas);

                const reverseCanvas = document.createElement('canvas');
                reverseCanvas.width = width;
                reverseCanvas.height = height;
                const reverseCtx = reverseCanvas.getContext('2d');
                const reverseTransformed = this.transformImage(this.outputImage.canvas, rCoeffs);
                reverseCtx.drawImage(reverseTransformed, 0, 0);
                reverseFrames.push(reverseCanvas);
            }

            // Reverse the reverse frames for proper sequence
            reverseFrames.reverse();

            // Combine frames
            for (let i = 0; i < forwardFrames.length; i++) {
                const combinedFrame = document.createElement('canvas');
                combinedFrame.width = width;
                combinedFrame.height = height;
                const ctx = combinedFrame.getContext('2d');
                ctx.clearRect(0, 0, width, height);

                if (this.imageStackOnTop) {
                    ctx.drawImage(forwardFrames[i], 0, 0);
                    ctx.drawImage(reverseFrames[i], 0, 0);
                } else {
                    ctx.drawImage(reverseFrames[i], 0, 0);
                    ctx.drawImage(forwardFrames[i], 0, 0);
                }

                this.frames.push(combinedFrame);
            }

        } catch (e) {
            console.error('Error creating zoom frames:', e);
            console.error(e.stack);
        }

        this.previewAnimation();
        this.animateFavicon();
    }

    // Helper function to transform an image using perspective transform
    transformImage(sourceCanvas, coeffs) {
        const [width, height] = this.originalSize;
        const destCanvas = document.createElement('canvas');
        destCanvas.width = width;
        destCanvas.height = height;
        const ctx = destCanvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);
        
        const sourceCtx = sourceCanvas.getContext('2d');
        const sourceData = sourceCtx.getImageData(0, 0, width, height);

        for(let y = 0; y < height; y++) {
            for(let x = 0; x < width; x++) {
                const w = coeffs[6]*x + coeffs[7]*y + 1;
                const srcX = Math.round((coeffs[0]*x + coeffs[1]*y + coeffs[2])/w);
                const srcY = Math.round((coeffs[3]*x + coeffs[4]*y + coeffs[5])/w);
                
                if(srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
                    const srcIdx = (srcY * width + srcX) * 4;
                    const dstIdx = (y * width + x) * 4;
                    for(let c = 0; c < 4; c++) {
                        imageData.data[dstIdx + c] = sourceData.data[srcIdx + c];
                    }
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return destCanvas;
    }

    // Add animation saving methods:
    saveApng(zoomIn = true) {
        this.createZoomFrames();
        
        if (!this.frames.length) {
            console.log("No frames created. Cannot save APNG.");
            return;
        }

        try {
            // Convert frames to UPNG format
            const frameData = this.frames.map(canvas => {
                const ctx = canvas.getContext('2d');
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                return new Uint8Array(imageData.data.buffer);
            });

            const frames = zoomIn ? frameData : frameData.reverse();
            const delays = new Array(frames.length).fill(100); // 100ms delay between frames

            // Create and save APNG
            const apngData = UPNG.encode(frames, this.originalSize[0], this.originalSize[1], 0, delays);
            const blob = new Blob([apngData], {type: 'image/png'});
            
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'animation.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
        } catch (e) {
            console.log("Error saving APNG:", e);
        }
    }

    saveGif(zoomIn = true) {
        this.createZoomFrames();
        
        if (!this.frames.length) {
            console.log("No frames created. Cannot save GIF.");
            return;
        }

        try {
            const gif = new GIF({
                workers: 2,
                quality: 10,
                width: this.originalSize[0],
                height: this.originalSize[1]
            });

            const frames = zoomIn ? this.frames : [...this.frames].reverse();
            frames.forEach(canvas => gif.addFrame(canvas, {delay: 100}));

            gif.on('finished', blob => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'animation.gif';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(a.href);
            });

            gif.render();
        } catch (e) {
            console.log("Error saving GIF:", e);
        }
    }

    saveApngZoomIn() {
        this.createZoomFrames();
        if (!this.frames.length) return;

        // Create APNG
        const apng = new UPNG.encode(
            this.frames.map(frame => {
                const ctx = frame.getContext('2d');
                return ctx.getImageData(0, 0, frame.width, frame.height).data.buffer;
            }), 
            this.originalSize[0], 
            this.originalSize[1], 
            0,  // no loops
            this.frames.map(() => 100)  // 100ms delay for each frame
        );

        // Create download
        const blob = new Blob([apng], {type: 'image/png'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'zoom_in.png';
        a.click();
        URL.revokeObjectURL(url);
    }

    saveApngZoomOut() {
        this.createZoomFrames();
        if (!this.frames.length) return;

        // Create APNG with reversed frames
        const apng = new UPNG.encode(
            [...this.frames].reverse().map(frame => {
                const ctx = frame.getContext('2d');
                return ctx.getImageData(0, 0, frame.width, frame.height).data.buffer;
            }), 
            this.originalSize[0], 
            this.originalSize[1], 
            0,
            this.frames.map(() => 100)
        );

        const blob = new Blob([apng], {type: 'image/png'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'zoom_out.png';
        a.click();
        URL.revokeObjectURL(url);
    }

    saveGifZoomIn() {
        this.createZoomFrames();
        if (!this.frames.length) return;

        const gif = new GIF({
            workers: 2,
            quality: 10,
            width: this.originalSize[0],
            height: this.originalSize[1]
        });

        this.frames.forEach(frame => gif.addFrame(frame, {delay: 100}));

        gif.on('finished', blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'zoom_in.gif';
            a.click();
            URL.revokeObjectURL(url);
        });

        gif.render();
    }

    saveGifZoomOut() {
        this.createZoomFrames();
        if (!this.frames.length) return;

        const gif = new GIF({
            workers: 2,
            quality: 10,
            width: this.originalSize[0],
            height: this.originalSize[1]
        });

        [...this.frames].reverse().forEach(frame => gif.addFrame(frame, {delay: 100}));

        gif.on('finished', blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'zoom_out.gif';
            a.click();
            URL.revokeObjectURL(url);
        });

        gif.render();
    }

    onCanvasResize() {
        if (!this.image) return;
        
        // Set canvas size to match image dimensions exactly
        this.canvas.width = this.originalSize[0];
        this.canvas.height = this.originalSize[1];
        this.canvasSize = [this.canvas.width, this.canvas.height];
        
        this.displayOutputImage();
    }

    displayOutputImage() {
        if (!this.outputImage) return;

        // Clear canvas
        const ctx = this.canvas.getContext('2d');
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw image
        ctx.drawImage(this.outputImage.canvas, 0, 0);

        // Draw corner dots and connecting lines
        if (this.transformationCorners.length >= 2) {
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
                    ctx.beginPath();
            
            // Draw lines connecting the dots in order
            const corners = this.transformationCorners;
            for (let i = 0; i < corners.length; i++) {
                const [x1, y1] = corners[i];
                const [x2, y2] = corners[(i + 1) % corners.length];
                
                if (i === 0) {
                    ctx.moveTo(x1, y1);
                }
                ctx.lineTo(x2, y2);
            }
            ctx.closePath();
            ctx.stroke();
        }

        // Draw corner dots on top
            ctx.fillStyle = 'red';
        this.transformationCorners.forEach(([x, y]) => {
                ctx.beginPath();
            ctx.arc(x, y, 8, 0, 2 * Math.PI);
                ctx.fill();
        });
    }

    onCanvasClick(event) {
        if (!this.image) return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const padding = 10;
        
        const imageX = Math.floor((event.clientX - rect.left) * scaleX);
        const imageY = Math.floor((event.clientY - rect.top) * scaleY);

        // Ensure coordinates stay within image bounds with padding
        const boundedX = Math.max(padding, Math.min(imageX, this.originalSize[0] - padding));
        const boundedY = Math.max(padding, Math.min(imageY, this.originalSize[1] - padding));

        console.log(`User selected coordinates: (${boundedX}, ${boundedY})`);
        console.log(`Image dimensions: ${this.originalSize[0]}x${this.originalSize[1]}`);

        // Only add new points if we have less than 4
        if (this.transformationCorners.length < 4) {
            this.transformationCorners.push([boundedX, boundedY]);
            this.updateOutputImage();
        }
    }

    updateOutputImage(generateFrames = true) {
        // Calculate iteration corners and create transformed copies
            this.calculateIterationCorners();
            const transformedImages = this.createTransformedCopies();
            this.stackTransformedImages(transformedImages);
        this.displayOutputImage();
        
        // Only generate frames if requested (when not dragging)
        if (generateFrames) {
            this.createZoomFrames();
        }
    }

    flipStack() {
        // Clear only frames
        this.frames = [];

        // Flip the stack order
        this.imageStackOnTop = !this.imageStackOnTop;

        // Update the image
        this.updateOutputImage();
    }

    loadDefaultImage() {
        const img = new Image();
        img.onload = () => {
            // Store original image
            this.image = img;
            this.originalSize = [img.width, img.height];
            
            // Create initial canvas with exact dimensions
            const initialCanvas = document.createElement('canvas');
            initialCanvas.width = this.originalSize[0];
            initialCanvas.height = this.originalSize[1];
            const ctx = initialCanvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0);
            
            this.outputImage = {
                canvas: initialCanvas,
                ctx: ctx
            };
            
            // Only set default corners if none exist
            if (this.transformationCorners.length === 0) {
                const padding = 10;
            this.transformationCorners = [
                    [550 + padding, 156 + padding],
                    [843 - padding, 87 + padding],
                    [902 - padding, 377 - padding],
                    [659 + padding, 337 - padding]
                ];
            }
            
            this.updateOutputImage();
            
            // Set up canvas after image is loaded
            window.addEventListener('resize', () => this.onCanvasResize());
            this.onCanvasResize();

            // Remove loading text
            const uploadText = this.canvas.parentElement.querySelector('.upload-text');
            if (uploadText) {
                uploadText.remove();
            }
        };
        img.onerror = () => {
            console.log("Error loading default image. Falling back to file upload.");
            const uploadText = document.createElement('div');
            uploadText.className = 'upload-text';
            uploadText.innerHTML = 'Drag image here';
            this.canvas.parentElement.appendChild(uploadText);
        };
        img.src = 'testframe.png';
    }

    // Add this method to handle animation preview
    previewAnimation() {
        if (!this.frames.length) return;

        // Stop any existing animations
        if (this.previewAnimationId) {
            cancelAnimationFrame(this.previewAnimationId);
            this.previewAnimationId = null;
        }

        const setupCanvas = (canvas) => {
            // Clear any existing content
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const maxWidth = (this.container.clientWidth - 80) / 2;
            const maxHeight = 300;
            const scale = Math.min(
                maxWidth / this.originalSize[0],
                maxHeight / this.originalSize[1]
            );
            
            canvas.width = this.originalSize[0] * scale;
            canvas.height = this.originalSize[1] * scale;
            return { scale, ctx: canvas.getContext('2d') };
        };

        // Reset and set up both canvases
        const zoomIn = setupCanvas(this.zoomInCanvas);
        const zoomOut = setupCanvas(this.zoomOutCanvas);

        let currentFrame = 0;
        let lastFrameTime = 0;
        const frameDelay = 100;

        const animate = (timestamp) => {
            if (!this.frames.length) {
                cancelAnimationFrame(this.previewAnimationId);
                this.previewAnimationId = null;
                return;
            }

            if (timestamp - lastFrameTime >= frameDelay) {
                // Draw zoom in animation
                zoomIn.ctx.clearRect(0, 0, this.zoomInCanvas.width, this.zoomInCanvas.height);
                zoomIn.ctx.save();
                zoomIn.ctx.scale(zoomIn.scale, zoomIn.scale);
                zoomIn.ctx.drawImage(this.frames[currentFrame], 0, 0);
                zoomIn.ctx.restore();

                // Draw zoom out animation (reverse order)
                zoomOut.ctx.clearRect(0, 0, this.zoomOutCanvas.width, this.zoomOutCanvas.height);
                zoomOut.ctx.save();
                zoomOut.ctx.scale(zoomOut.scale, zoomOut.scale);
                zoomOut.ctx.drawImage(this.frames[this.frames.length - 1 - currentFrame], 0, 0);
                zoomOut.ctx.restore();

                currentFrame = (currentFrame + 1) % this.frames.length;
                lastFrameTime = timestamp;
            }
            this.previewAnimationId = requestAnimationFrame(animate);
        };

        // Start fresh animation
        currentFrame = 0;
        animate(performance.now());
    }

    animateFavicon() {
        if (!this.frames.length) return;

        // Create a small canvas for the favicon (32x32 is standard)
        const faviconCanvas = document.createElement('canvas');
        faviconCanvas.width = 32;
        faviconCanvas.height = 32;
        const ctx = faviconCanvas.getContext('2d');

        let currentFrame = 0;
        const frameDelay = 100;

        // Find or create favicon link element
        let favicon = document.querySelector('link[rel="icon"]');
        if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
        }

        const updateFavicon = () => {
            // Clear and draw current frame
            ctx.clearRect(0, 0, 32, 32);
            ctx.drawImage(this.frames[currentFrame], 0, 0, 32, 32);
            
            // Convert to data URL and update favicon
            favicon.href = faviconCanvas.toDataURL('image/png');
            
            // Move to next frame
            currentFrame = (currentFrame + 1) % this.frames.length;
            
            // Schedule next update
            setTimeout(updateFavicon, frameDelay);
        };

        // Start animation
        updateFavicon();
    }

    // Add these new methods for drag functionality
    setupDragHandlers() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.onMouseUp.bind(this));

        // Touch events
        this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
        this.canvas.addEventListener('touchcancel', this.onTouchEnd.bind(this));
    }

    // Add this method to check if a point is inside a polygon
    isPointInPolygon(x, y, corners) {
        let inside = false;
        for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
            const xi = corners[i][0], yi = corners[i][1];
            const xj = corners[j][0], yj = corners[j][1];
            
            const intersect = ((yi > y) !== (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    onMouseDown(event) {
        if (!this.image) return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const clickX = (event.clientX - rect.left) * scaleX;
        const clickY = (event.clientY - rect.top) * scaleY;

        // Check if click is near any corner
        for (let i = 0; i < this.transformationCorners.length; i++) {
            const [cornerX, cornerY] = this.transformationCorners[i];
            const distance = Math.sqrt(
                Math.pow(clickX - cornerX, 2) + 
                Math.pow(clickY - cornerY, 2)
            );

            // If click is within 10 pixels of a corner, select it for dragging
            if (distance < 10) {
                this.selectedCorner = i;
                this.isDragging = true;
                this.dragStartX = clickX;
                this.dragStartY = clickY;
                this.originalCorners = this.transformationCorners.map(corner => [...corner]);
                return;
            }
        }

        // Check if click is near any line
        for (let i = 0; i < this.transformationCorners.length; i++) {
            const [x1, y1] = this.transformationCorners[i];
            const [x2, y2] = this.transformationCorners[(i + 1) % this.transformationCorners.length];
            
            const distanceToLine = this.pointToLineDistance(clickX, clickY, x1, y1, x2, y2);
            
            if (distanceToLine < 10) {
                this.selectedLine = i;
                this.isDragging = true;
                this.dragStartX = clickX;
                this.dragStartY = clickY;
                this.originalCorners = this.transformationCorners.map(corner => [...corner]);
                return;
            }
        }

        // If we have 4 corners and click is inside the shape, move the whole shape
        if (this.transformationCorners.length === 4 && 
            this.isPointInPolygon(clickX, clickY, this.transformationCorners)) {
            this.isDraggingShape = true;
            this.isDragging = true;
            this.dragStartX = clickX;
            this.dragStartY = clickY;
            this.originalCorners = this.transformationCorners.map(corner => [...corner]);
        }
    }

    onMouseMove(event) {
        if (!this.isDragging) return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const currentX = (event.clientX - rect.left) * scaleX;
        const currentY = (event.clientY - rect.top) * scaleY;
        
        const deltaX = currentX - this.dragStartX;
        const deltaY = currentY - this.dragStartY;

        const padding = 10;

        if (this.isDraggingShape) {
            // Move all corners while maintaining shape
            const newCorners = this.originalCorners.map(([x, y]) => {
                let newX = x + deltaX;
                let newY = y + deltaY;
                
                // Ensure coordinates stay within image bounds with padding
                newX = Math.max(padding, Math.min(newX, this.originalSize[0] - padding));
                newY = Math.max(padding, Math.min(newY, this.originalSize[1] - padding));
                
                return [newX, newY];
            });

            // Only update if all points are within bounds
            if (newCorners.every(([x, y]) => 
                x >= padding && x <= this.originalSize[0] - padding &&
                y >= padding && y <= this.originalSize[1] - padding)) {
                this.transformationCorners = newCorners;
            }
        } else if (this.selectedCorner !== null) {
            // Get proposed new position
            let newX = this.originalCorners[this.selectedCorner][0] + deltaX;
            let newY = this.originalCorners[this.selectedCorner][1] + deltaY;

            // Ensure coordinates stay within image bounds with padding
            newX = Math.max(padding, Math.min(newX, this.originalSize[0] - padding));
            newY = Math.max(padding, Math.min(newY, this.originalSize[1] - padding));

            // Check if new position would cross any lines formed by other points
            const otherPoints = this.transformationCorners
                .map((p, i) => ({ point: p, index: i }))
                .filter(p => p.index !== this.selectedCorner);

            // For each pair of other points, check if new position would cross their line
            for (let i = 0; i < otherPoints.length - 1; i++) {
                for (let j = i + 1; j < otherPoints.length; j++) {
                    const p1 = otherPoints[i].point;
                    const p2 = otherPoints[j].point;

                    // Calculate cross product to determine which side of the line the point is on
                    const crossProduct = (p2[0] - p1[0]) * (newY - p1[1]) - (p2[1] - p1[1]) * (newX - p1[0]);
                    
                    // Calculate original cross product to compare
                    const originalPoint = this.originalCorners[this.selectedCorner];
                    const originalCross = (p2[0] - p1[0]) * (originalPoint[1] - p1[1]) - 
                                       (p2[1] - p1[1]) * (originalPoint[0] - p1[0]);

                    // If sign changes, point is trying to cross the line
                    if (Math.sign(crossProduct) !== Math.sign(originalCross)) {
                        // Project point onto the line and move it slightly to the original side
                        const lineVectorX = p2[0] - p1[0];
                        const lineVectorY = p2[1] - p1[1];
                        const lineLength = Math.sqrt(lineVectorX * lineVectorX + lineVectorY * lineVectorY);
                        
                        // Normalize line vector
                        const normalX = -lineVectorY / lineLength;
                        const normalY = lineVectorX / lineLength;
                        
                        // Project point onto line
                        const dot = ((newX - p1[0]) * lineVectorX + (newY - p1[1]) * lineVectorY) / lineLength;
                        const projX = p1[0] + (dot * lineVectorX) / lineLength;
                        const projY = p1[1] + (dot * lineVectorY) / lineLength;
                        
                        // Move point slightly away from line in original direction
                        const minDistance = 5;
                        const sign = Math.sign(originalCross);
                        newX = projX + normalX * minDistance * sign;
                        newY = projY + normalY * minDistance * sign;
                    }
                }
            }

            this.transformationCorners[this.selectedCorner] = [newX, newY];
        } else if (this.selectedLine !== null) {
            // Move both corners of the line while maintaining shape
            const i1 = this.selectedLine;
            const i2 = (this.selectedLine + 1) % this.transformationCorners.length;
            
            let newX1 = this.originalCorners[i1][0] + deltaX;
            let newY1 = this.originalCorners[i1][1] + deltaY;
            let newX2 = this.originalCorners[i2][0] + deltaX;
            let newY2 = this.originalCorners[i2][1] + deltaY;

            // Ensure both points stay within bounds with padding
            newX1 = Math.max(padding, Math.min(newX1, this.originalSize[0] - padding));
            newY1 = Math.max(padding, Math.min(newY1, this.originalSize[1] - padding));
            newX2 = Math.max(padding, Math.min(newX2, this.originalSize[0] - padding));
            newY2 = Math.max(padding, Math.min(newY2, this.originalSize[1] - padding));
            
            this.transformationCorners[i1] = [newX1, newY1];
            this.transformationCorners[i2] = [newX2, newY2];
        }

        this.updateOutputImage(false);
    }

    onMouseUp() {
        if (this.isDragging) {
            this.updateOutputImage(true);
        }
        this.isDragging = false;
        this.isDraggingShape = false;
        this.selectedCorner = null;
        this.selectedLine = null;
    }

    // Update touch handlers to support shape dragging
    onTouchStart(event) {
        event.preventDefault();
        if (!this.image || event.touches.length !== 1) return;

        const touch = event.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const clickX = (touch.clientX - rect.left) * scaleX;
        const clickY = (touch.clientY - rect.top) * scaleY;

        // If we have less than 4 corners, add a new one
        if (this.transformationCorners.length < 4) {
            const padding = 10;
            const boundedX = Math.max(padding, Math.min(clickX, this.originalSize[0] - padding));
            const boundedY = Math.max(padding, Math.min(clickY, this.originalSize[1] - padding));
            this.transformationCorners.push([boundedX, boundedY]);
            this.updateOutputImage();
            return;
        }

        // Check if touch is near any corner
        for (let i = 0; i < this.transformationCorners.length; i++) {
            const [cornerX, cornerY] = this.transformationCorners[i];
            const distance = Math.sqrt(
                Math.pow(clickX - cornerX, 2) + 
                Math.pow(clickY - cornerY, 2)
            );

            if (distance < 20) {
                this.selectedCorner = i;
                this.isDragging = true;
                this.dragStartX = clickX;
                this.dragStartY = clickY;
                this.originalCorners = this.transformationCorners.map(corner => [...corner]);
                return;
            }
        }

        // Check if touch is near any line
        for (let i = 0; i < this.transformationCorners.length; i++) {
            const [x1, y1] = this.transformationCorners[i];
            const [x2, y2] = this.transformationCorners[(i + 1) % this.transformationCorners.length];
            
            const distanceToLine = this.pointToLineDistance(clickX, clickY, x1, y1, x2, y2);
            
            if (distanceToLine < 20) {
                this.selectedLine = i;
                this.isDragging = true;
                this.dragStartX = clickX;
                this.dragStartY = clickY;
                this.originalCorners = this.transformationCorners.map(corner => [...corner]);
                return;
            }
        }

        // If touch is inside the shape, move the whole shape
        if (this.transformationCorners.length === 4 && 
            this.isPointInPolygon(clickX, clickY, this.transformationCorners)) {
            this.isDraggingShape = true;
            this.isDragging = true;
            this.dragStartX = clickX;
            this.dragStartY = clickY;
            this.originalCorners = this.transformationCorners.map(corner => [...corner]);
        }
    }

    onTouchMove(event) {
        event.preventDefault();
        if (!this.isDragging || event.touches.length !== 1) return;

        const touch = event.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const currentX = (touch.clientX - rect.left) * scaleX;
        const currentY = (touch.clientY - rect.top) * scaleY;
        
        const deltaX = currentX - this.dragStartX;
        const deltaY = currentY - this.dragStartY;

        const padding = 10;

        if (this.isDraggingShape) {
            // Move all corners while maintaining shape
            const newCorners = this.originalCorners.map(([x, y]) => {
                let newX = x + deltaX;
                let newY = y + deltaY;

            // Ensure coordinates stay within image bounds with padding
            newX = Math.max(padding, Math.min(newX, this.originalSize[0] - padding));
            newY = Math.max(padding, Math.min(newY, this.originalSize[1] - padding));
                
                return [newX, newY];
            });

            // Only update if all points are within bounds
            if (newCorners.every(([x, y]) => 
                x >= padding && x <= this.originalSize[0] - padding &&
                y >= padding && y <= this.originalSize[1] - padding)) {
                this.transformationCorners = newCorners;
            }
        } else if (this.selectedCorner !== null) {
            // Get proposed new position
            let newX = this.originalCorners[this.selectedCorner][0] + deltaX;
            let newY = this.originalCorners[this.selectedCorner][1] + deltaY;

            // Ensure coordinates stay within image bounds with padding
            newX = Math.max(padding, Math.min(newX, this.originalSize[0] - padding));
            newY = Math.max(padding, Math.min(newY, this.originalSize[1] - padding));

            // Check if new position would cross any lines formed by other points
            const otherPoints = this.transformationCorners
                .map((p, i) => ({ point: p, index: i }))
                .filter(p => p.index !== this.selectedCorner);

            // For each pair of other points, check if new position would cross their line
            for (let i = 0; i < otherPoints.length - 1; i++) {
                for (let j = i + 1; j < otherPoints.length; j++) {
                    const p1 = otherPoints[i].point;
                    const p2 = otherPoints[j].point;

                    // Calculate cross product to determine which side of the line the point is on
                    const crossProduct = (p2[0] - p1[0]) * (newY - p1[1]) - (p2[1] - p1[1]) * (newX - p1[0]);
                    
                    // Calculate original cross product to compare
                    const originalPoint = this.originalCorners[this.selectedCorner];
                    const originalCross = (p2[0] - p1[0]) * (originalPoint[1] - p1[1]) - 
                                       (p2[1] - p1[1]) * (originalPoint[0] - p1[0]);

                    // If sign changes, point is trying to cross the line
                    if (Math.sign(crossProduct) !== Math.sign(originalCross)) {
                        // Project point onto the line and move it slightly to the original side
                        const lineVectorX = p2[0] - p1[0];
                        const lineVectorY = p2[1] - p1[1];
                        const lineLength = Math.sqrt(lineVectorX * lineVectorX + lineVectorY * lineVectorY);
                        
                        // Normalize line vector
                        const normalX = -lineVectorY / lineLength;
                        const normalY = lineVectorX / lineLength;
                        
                        // Project point onto line
                        const dot = ((newX - p1[0]) * lineVectorX + (newY - p1[1]) * lineVectorY) / lineLength;
                        const projX = p1[0] + (dot * lineVectorX) / lineLength;
                        const projY = p1[1] + (dot * lineVectorY) / lineLength;
                        
                        // Move point slightly away from line in original direction
                        const minDistance = 5;
                        const sign = Math.sign(originalCross);
                        newX = projX + normalX * minDistance * sign;
                        newY = projY + normalY * minDistance * sign;
                    }
                }
            }

            this.transformationCorners[this.selectedCorner] = [newX, newY];
        } else if (this.selectedLine !== null) {
            // Move both corners of the line while maintaining shape
            const i1 = this.selectedLine;
            const i2 = (this.selectedLine + 1) % this.transformationCorners.length;
            
            let newX1 = this.originalCorners[i1][0] + deltaX;
            let newY1 = this.originalCorners[i1][1] + deltaY;
            let newX2 = this.originalCorners[i2][0] + deltaX;
            let newY2 = this.originalCorners[i2][1] + deltaY;

            // Ensure both points stay within bounds with padding
            newX1 = Math.max(padding, Math.min(newX1, this.originalSize[0] - padding));
            newY1 = Math.max(padding, Math.min(newY1, this.originalSize[1] - padding));
            newX2 = Math.max(padding, Math.min(newX2, this.originalSize[0] - padding));
            newY2 = Math.max(padding, Math.min(newY2, this.originalSize[1] - padding));
            
            this.transformationCorners[i1] = [newX1, newY1];
            this.transformationCorners[i2] = [newX2, newY2];
        }

        this.updateOutputImage(false);
    }

    onTouchEnd(event) {
        event.preventDefault();
        if (this.isDragging) {
            this.updateOutputImage(true);
        }
        this.isDragging = false;
        this.isDraggingShape = false;
        this.selectedCorner = null;
        this.selectedLine = null;
    }

    // Helper method to calculate distance from point to line segment
    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;

        if (len_sq !== 0) {
            param = dot / len_sq;
        }

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = px - xx;
        const dy = py - yy;

        return Math.sqrt(dx * dx + dy * dy);
    }
}

// Initialize the application
window.onload = () => {
    new ImageEditor();
}; 