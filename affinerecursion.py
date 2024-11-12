import tkinter as tk
import os
from tkinter import filedialog
from PIL import Image, ImageTk, ImageDraw
from apng import APNG
import numpy as np
import math
import tempfile


class ImageEditor:
    def __init__(self, root):
        self.root = root
        self.root.title("Image Editor")

        self.image = None
        self.original_size = (0, 0)
        self.canvas = None
        self.image_references = []
        self.output_image = None
        self.enlarged_image = None
        self.enlarged_image_size = (0, 0)
        self.origin_x = self.origin_y = 0
        self.original_origin_x = self.original_origin_y = 0
        self.enlarged_origin_x = self.enlarged_origin_y = 0
        self.frames = []
        self.image_stack_on_top = True
        self.canvas_size = (0, 0)
        self.scale_factor = 1.0
        self.canvas_image = None

        self.contracting_corner_sets = []
        self.expanding_corner_sets = []


        self.transformation_corners = []  # Store corner positions
        self.current_corner = 0  # Track which corner we're setting

        # First setup the UI (which creates the canvas)
        self.setup_ui()
        
        # Then bind the mouse click event to the canvas
        self.canvas.bind("<Button-1>", self.on_canvas_click)
        
        # Finally load the image
        self.load_image()

    def setup_ui(self):
        # Frame for buttons and sliders
        controls_frame = tk.Frame(self.root)
        controls_frame.pack(fill=tk.X, padx=10, pady=10)

        # Load Image Button
        load_button = tk.Button(controls_frame, text="Load Image", command=self.load_image)
        load_button.pack(side=tk.LEFT, padx=5)

        # Save Image Button
        save_button = tk.Button(controls_frame, text="Save Image", command=self.save_image)
        save_button.pack(side=tk.LEFT, padx=5)


        # flip Image stack Button
        flip_stack_button = tk.Button(controls_frame, text="Flip Stack Above/Below", command=self.flip_stack)
        flip_stack_button.pack(side=tk.LEFT, padx=5)


        # Zoom In APNG Button
        zoom_in_apng_button = tk.Button(controls_frame, text="Zoom In APNG", command=self.save_apng_zoom_in)
        zoom_in_apng_button.pack(side=tk.LEFT, padx=5)
        
        # Zoom Out APNG Button
        zoom_out_apng_button = tk.Button(controls_frame, text="Zoom Out APNG", command=self.save_apng_zoom_out)
        zoom_out_apng_button.pack(side=tk.LEFT, padx=5)

        # Zoom In GIF Button
        zoom_in_gif_button = tk.Button(controls_frame, text="Zoom In GIF", command=self.save_gif_zoom_in)
        zoom_in_gif_button.pack(side=tk.LEFT, padx=5)
        
        # Zoom Out GIF Button
        zoom_out_gif_button = tk.Button(controls_frame, text="Zoom Out GIF", command=self.save_gif_zoom_out)
        zoom_out_gif_button.pack(side=tk.LEFT, padx=5)


        # Textbox for frame_count
        self.frame_count_entry = tk.Entry(controls_frame, width=10)
        self.frame_count_entry.insert(0, "15")  # Default number of frames
        self.frame_count_entry.pack(side=tk.LEFT, padx=5)
    
        # Canvas
        self.canvas = tk.Canvas(self.root, bg='white')
        self.canvas.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        self.canvas.bind("<Configure>", self.on_canvas_resize)

    def load_image(self):
        try:
            file_path = filedialog.askopenfilename(filetypes=[("Image Files", "*.png;*.jpg;*.jpeg;*.bmp")])
            if file_path:
                self.image = Image.open(file_path).convert("RGBA")
                self.original_size = self.image.size
                self.update_output_image()
        except Exception as e:
            print(f"Error loading image: {e}")

    def calculate_iteration_corners(self):
        """Calculate corner positions for recursive transformations"""

        self.contracting_corner_sets = []
        self.expanding_corner_sets = []

        if len(self.transformation_corners) < 4:
            return [], []
        
        def calculate_min_distance(corners):
            """Calculate minimum distance between any two corners"""
            min_dist = float('inf')
            for i in range(len(corners)):
                x1, y1 = corners[i]
                for j in range(i + 1, len(corners)):
                    x2, y2 = corners[j]
                    dist = math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
                    min_dist = min(min_dist, dist)
            return min_dist
        
        # Get original image dimensions
        width, height = self.original_size
        original_corners = [(0, 0), (width, 0), (width, height), (0, height)]
        
        print("\nDebug Information:")
        print(f"Original corners: {original_corners}")
        print(f"User-selected corners: {self.transformation_corners}")
        
        # Calculate transformation coefficients
        transform_coeffs = self.find_coeffs(original_corners, self.transformation_corners)
        inverse_coeffs = self.find_coeffs(self.transformation_corners, original_corners)
        print(f"Transform coefficients: {transform_coeffs}")
        print(f"Inverse coefficients: {inverse_coeffs}")
        
        # Initialize both corner sets
        contracting_corners = original_corners.copy()
        expanding_corners = original_corners.copy()
        iteration = 0
        max_iterations = 20  # Safety limit
        print("\nTransformations:")
        
        while iteration < max_iterations:
            min_distance = calculate_min_distance(contracting_corners)
            if min_distance < 1:
                print(f"Breaking loop - min distance ({min_distance:.2f}) < 1")
                break
                
            print(f"\nIteration {iteration + 1}:")
            print(f"Contracting corners: {contracting_corners}")
            print(f"Min distance: {min_distance:.2f}")
            
            # Calculate next contracting corners
            next_contracting = []
            for x, y in contracting_corners:
                denominator = transform_coeffs[6] * x + transform_coeffs[7] * y + 1
                new_x = (transform_coeffs[0] * x + transform_coeffs[1] * y + transform_coeffs[2]) / denominator
                new_y = (transform_coeffs[3] * x + transform_coeffs[4] * y + transform_coeffs[5]) / denominator
                next_contracting.append((new_x, new_y))
            
            # Calculate next expanding corners
            next_expanding = []
            for x, y in expanding_corners:
                denominator = inverse_coeffs[6] * x + inverse_coeffs[7] * y + 1
                new_x = (inverse_coeffs[0] * x + inverse_coeffs[1] * y + inverse_coeffs[2]) / denominator
                new_y = (inverse_coeffs[3] * x + inverse_coeffs[4] * y + inverse_coeffs[5]) / denominator
                next_expanding.append((new_x, new_y))
            
            print(f"Next contracting corners: {next_contracting}")
            print(f"Next expanding corners: {next_expanding}")
            
            self.contracting_corner_sets.append(next_contracting)
            self.expanding_corner_sets.append(next_expanding)
            
            contracting_corners = next_contracting
            expanding_corners = next_expanding
            iteration += 1
        
        print(f"\nFinal number of corner sets: {len(self.contracting_corner_sets)}")
        return self.contracting_corner_sets, self.expanding_corner_sets

    def create_transformed_copies(self):
        """Step 2: Create all transformed copies using the corner sets"""
        width, height = self.original_size
        original_corners = [(0, 0), (width, 0), (width, height), (0, height)]
        transformed_images = []
        
        print("\nCreating transformed copies:")
        print(f"Expanding sets: {len(self.expanding_corner_sets)}")
        print(f"Contracting sets: {len(self.contracting_corner_sets)}")
        
        # Create expanding transformations (from largest to smallest)
        for expanding_corners in reversed(self.expanding_corner_sets):
            # Transform from original corners to expanded corners
            expanding_coeffs = self.find_coeffs(original_corners, expanding_corners)
            expanding_transformed = self.image.transform(
                self.original_size,
                Image.PERSPECTIVE,
                expanding_coeffs,
                Image.Resampling.BICUBIC
            )
            transformed_images.append(expanding_transformed)
            print(f"Added expanding transformation")
        
        # Add original image in the middle
        transformed_images.append(self.image)
        print("Added original image")
        
        # Create contracting transformations (from largest to smallest)
        for contracting_corners in self.contracting_corner_sets:
            # Transform from original corners to contracted corners
            contracting_coeffs = self.find_coeffs(original_corners, contracting_corners)
            contracting_transformed = self.image.transform(
                self.original_size,
                Image.PERSPECTIVE,
                contracting_coeffs,
                Image.Resampling.BICUBIC
            )
            transformed_images.append(contracting_transformed)
            print(f"Added contracting transformation")
        
        print(f"Total images created: {len(transformed_images)}")
        return transformed_images

    def stack_transformed_images(self, transformed_images):
        """Step 3: Stack all transformed images together"""
        if self.output_image:
            self.output_image.close()
        self.output_image = Image.new("RGBA", self.original_size, (255, 255, 255, 0))
        
        if not self.image_stack_on_top:
            # Stack from bottom to top
            for image in transformed_images:
                self.output_image.paste(image, (0, 0), image)
        else:
            # Stack from top to bottom
            for image in reversed(transformed_images):
                self.output_image.paste(image, (0, 0), image)

    def update_output_image(self, event=None):
        """Main method that coordinates the three steps"""
        if not self.image:
            return
            
        if len(self.transformation_corners) < 4:
            self.output_image = self.image.copy()
            self.display_output_image()
            return
            
        try:
            # Step 1: Calculate all corner positions
            self.contracting_corner_sets, self.expanding_corner_sets = self.calculate_iteration_corners()
            
            # Step 2: Create transformed copies
            transformed_images = self.create_transformed_copies()
            
            # Step 3: Stack the images together
            self.stack_transformed_images(transformed_images)
            
        except Exception as e:
            print(f"Error applying transformation: {e}")
            self.output_image = self.image.copy()
        
        self.display_output_image()

    def find_coeffs(self, pa, pb):
        """
        Calculate coefficients for perspective transformation
        pa: list of corner coordinates in transformed image
        pb: list of corner coordinates in original image
        """
        matrix = []
        for p1, p2 in zip(pa, pb):
            matrix.append([p1[0], p1[1], 1, 0, 0, 0, -p2[0]*p1[0], -p2[0]*p1[1]])
            matrix.append([0, 0, 0, p1[0], p1[1], 1, -p2[1]*p1[0], -p2[1]*p1[1]])

        A = np.matrix(matrix, dtype=np.float64)
        B = np.array(pb).reshape(8)

        res = np.dot(np.linalg.inv(A.T * A) * A.T, B)
        return np.array(res).reshape(8)

    def interpolate_spiral_points(self, start_point, end_point, center_point, num_points=20):
        """Interpolate points along a logarithmic spiral path"""
        points = []
        
        # Convert to polar coordinates relative to center
        def to_polar(point):
            x = point[0] - center_point[0]
            y = point[1] - center_point[1]
            r = math.sqrt(x*x + y*y)
            theta = math.atan2(y, x)
            return r, theta
        
        # Convert from polar back to cartesian
        def to_cartesian(r, theta):
            x = center_point[0] + r * math.cos(theta)
            y = center_point[1] + r * math.sin(theta)
            return (x, y)
        
        # Get polar coordinates of start and end points
        r1, theta1 = to_polar(start_point)
        r2, theta2 = to_polar(end_point)
        
        # Unwrap theta2 to ensure we take the shorter path
        while theta2 - theta1 > math.pi:
            theta2 -= 2 * math.pi
        while theta1 - theta2 > math.pi:
            theta2 += 2 * math.pi
        
        # Calculate logarithmic spiral parameters
        b = math.log(r2/r1) / (theta2 - theta1) if theta2 != theta1 else 0
        a = r1 / math.exp(b * theta1)
        
        # Generate points along the spiral
        for t in np.linspace(0, 1, num_points):
            theta = theta1 + (theta2 - theta1) * t
            r = a * math.exp(b * theta)
            points.append(to_cartesian(r, theta))
        
        return points

    def display_output_image(self):
        if self.output_image:
            # Resize the output image to fit the canvas
            resized_image = self.output_image.copy()
            resized_image.thumbnail(self.canvas_size, Image.Resampling.LANCZOS)
            
            # Convert the image for display
            self.tk_image = ImageTk.PhotoImage(resized_image)
            
            # Clear previous image and display the new one
            self.canvas.delete("all")
            
            # Draw the image
            self.canvas_image = self.canvas.create_image(
                self.canvas_size[0] // 2, 
                self.canvas_size[1] // 2, 
                image=self.tk_image, 
                anchor=tk.CENTER
            )
            
            # Calculate scaling factors and offsets
            scale_x = self.canvas_size[0] / self.original_size[0]
            scale_y = self.canvas_size[1] / self.original_size[1]
            scale = min(scale_x, scale_y)
            
            # Calculate the actual image dimensions on canvas
            image_width_on_canvas = self.original_size[0] * scale
            image_height_on_canvas = self.original_size[1] * scale
            
            # Calculate image offset on canvas (for centering)
            offset_x = (self.canvas_size[0] - image_width_on_canvas) / 2
            offset_y = (self.canvas_size[1] - image_height_on_canvas) / 2
            
            # Draw corner markers if they exist
            for i, (x, y) in enumerate(self.transformation_corners):
                # Convert image coordinates to canvas coordinates
                canvas_x = (x * scale) + offset_x
                canvas_y = (y * scale) + offset_y
                
                # Draw a small circle at each corner
                radius = 5
                color = "red" if i == self.current_corner else "blue"
                self.canvas.create_oval(
                    canvas_x - radius, canvas_y - radius,
                    canvas_x + radius, canvas_y + radius,
                    fill=color, outline=color
                )

            if len(self.transformation_corners) == 4:
                # Calculate corner sets and fit spirals
                self.contracting_corner_sets, self.expanding_corner_sets = self.calculate_iteration_corners()
                
                # Define colors for each corner's points
                corner_colors = ['purple', 'orange', 'green', 'cyan']
                
                # For each corner, create and draw its spiral
                for corner_index in range(4):
                    # Collect positions for this corner - only original and contracting
                    corner_positions = []
                    
                    # Add original corner first
                    corner_positions.append([(0, 0), (self.original_size[0], 0), 
                                          (self.original_size[0], self.original_size[1]), 
                                          (0, self.original_size[1])][corner_index])
                    
                    # Add contracting positions in order (largest to smallest)
                    for corners in self.contracting_corner_sets:
                        corner_positions.append(corners[corner_index])
                    
                    # Get the convergence point (final point in contracting set)
                    center_point = self.contracting_corner_sets[-1][corner_index]

                    # Draw original points used for fitting
                    for x, y in corner_positions:
                        canvas_x = (x * scale) + offset_x
                        canvas_y = (y * scale) + offset_y
                        self.canvas.create_oval(
                            canvas_x - 2, canvas_y - 2,
                            canvas_x + 2, canvas_y + 2,
                            fill=corner_colors[corner_index], 
                            outline=corner_colors[corner_index]
                        )

                    # Draw spiral using the convergence point as center
                    width, height = self.original_size
                    original_corners = [(0, 0), (width, 0), (width, height), (0, height)]
                    start_point = original_corners[corner_index]
                    end_point = self.transformation_corners[corner_index]
                    
                    spiral_points = self.interpolate_spiral_points(
                        start_point, 
                        end_point, 
                        center_point, 
                        num_points=40
                    )
                    
                    # Draw interpolated points
                    prev_point = None
                    for x, y in spiral_points:
                        canvas_x = (x * scale) + offset_x
                        canvas_y = (y * scale) + offset_y
                        
                        # Draw point
                        self.canvas.create_oval(
                            canvas_x - 1, canvas_y - 1,
                            canvas_x + 1, canvas_y + 1,
                            fill='yellow',
                            outline='yellow'
                        )
                        
                        # Draw line segment connecting points
                        if prev_point:
                            prev_x = (prev_point[0] * scale) + offset_x
                            prev_y = (prev_point[1] * scale) + offset_y
                            self.canvas.create_line(
                                prev_x, prev_y,
                                canvas_x, canvas_y,
                                fill='yellow',
                                width=1
                            )
                        prev_point = (x, y)

    def save_image(self):
        if not self.output_image:
            print("No output image available to save.")
            return

        try:
            file_path = filedialog.asksaveasfilename(defaultextension=".png", filetypes=[("PNG Files", "*.png")])
            if file_path:
                self.output_image.save(file_path)
                print(f"Image saved as {file_path}")
        except Exception as e:
            print(f"Error saving image: {e}")

    def flip_stack(self):
        if self.image_stack_on_top is True:
            self.image_stack_on_top = False
        else:
            self.image_stack_on_top = True
        self.update_output_image()


    def create_zoom_frames(self):
        if not self.output_image or len(self.transformation_corners) < 4:
            print("No output image or insufficient corner positions.")
            return

        # Clear previous frames
        self.frames.clear()

        # Get number of frames from entry widget
        try:
            num_frames = int(self.frame_count_entry.get())
        except ValueError:
            print("Invalid frame count. Using default of 15.")
            num_frames = 15

        # Get original corners
        width, height = self.original_size
        original_corners = [(0, 0), (width, 0), (width, height), (0, height)]

        # Generate spiral paths for each corner using its own convergence point
        corner_paths = []
        for i in range(4):
            center_point = self.contracting_corner_sets[-1][i]  # Use convergence point as center
            spiral_points = self.interpolate_spiral_points(
                original_corners[i],
                self.transformation_corners[i],
                center_point,
                num_points=num_frames + 1  # Include end point
            )
            corner_paths.append(spiral_points[:-1])  # Exclude the last point here instead

        # Create frame for each set of interpolated corners
        for frame_idx in range(num_frames):
            frame_corners = [path[frame_idx] for path in corner_paths]
            frame_coeffs = self.find_coeffs(original_corners, frame_corners)
            frame = self.output_image.transform(
                self.original_size,
                Image.PERSPECTIVE,
                frame_coeffs,
                Image.Resampling.BICUBIC
            )
            self.frames.append(frame)

        print(f"Created {len(self.frames)} zoom frames")

    def save_apng(self, zoom_in=True):
        self.create_zoom_frames()
        
        if not self.frames:
            print("No frames created. Cannot save APNG.")
            return

        try:
            file_path = filedialog.asksaveasfilename(defaultextension=".png", filetypes=[("APNG Files", "*.png")])
            if file_path:
                apng = APNG()
                frame_list = self.frames if zoom_in else reversed(self.frames)
                for frame_image in frame_list:
                    # Save the frame to a temporary file and append it to the APNG
                    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temp_file:
                        frame_image.save(temp_file.name)
                        apng.append_file(temp_file.name, delay=100)  # Adjust delay as needed
                apng.save(file_path)
                print(f"Zoom APNG saved as {file_path}")
            else:
                print("No file path provided. APNG not saved.")
        except Exception as e:
            print(f"Error saving APNG: {e}")

    def save_apng_zoom_in(self):
        self.save_apng(zoom_in=True)

    def save_apng_zoom_out(self):
        self.save_apng(zoom_in=False)

    def save_gif(self, zoom_in=True):
        self.create_zoom_frames()
        
        if not self.frames:
            print("No frames created. Cannot save GIF.")
            return

        try:
            file_path = filedialog.asksaveasfilename(defaultextension=".gif", filetypes=[("GIF Files", "*.gif")])
            if file_path:
                # Use temporary files to store each frame
                temp_files = []
                frame_list = self.frames if zoom_in else reversed(self.frames)
                for frame_image in frame_list:
                    temp_file = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
                    frame_image.save(temp_file.name)
                    temp_files.append(temp_file.name)

                # Load all frames from temporary files
                gif_frames = [Image.open(temp_file) for temp_file in temp_files]

                # Save as GIF
                if gif_frames:
                    gif_frames[0].save(
                        file_path,
                        save_all=True,
                        append_images=gif_frames[1:],
                        duration=100,  # 100ms per frame
                        loop=0  # 0 means infinite loop
                    )
                    print(f"Zoom GIF saved as {file_path}")

                # Clean up temporary files
                for temp_file in temp_files:
                    os.remove(temp_file)
            else:
                print("No file path provided. GIF not saved.")
        except Exception as e:
            print(f"Error saving GIF: {e}")

    def save_gif_zoom_in(self):
        self.save_gif(zoom_in=True)

    def save_gif_zoom_out(self):
        self.save_gif(zoom_in=False)

    def on_canvas_resize(self, event):
        self.canvas_size = (event.width, event.height)
        self.display_output_image()

    def on_canvas_click(self, event):
        """Handle mouse clicks on the canvas"""
        if not self.image:
            return
        
        # Get click coordinates relative to the canvas
        canvas_x = event.x
        canvas_y = event.y
        
        # Calculate scaling factors and offsets
        scale_x = self.canvas_size[0] / self.original_size[0]
        scale_y = self.canvas_size[1] / self.original_size[1]
        scale = min(scale_x, scale_y)  # Use the smaller scale to maintain aspect ratio
        
        # Calculate the actual image dimensions on canvas
        image_width_on_canvas = self.original_size[0] * scale
        image_height_on_canvas = self.original_size[1] * scale
        
        # Calculate image offset on canvas (for centering)
        offset_x = (self.canvas_size[0] - image_width_on_canvas) / 2
        offset_y = (self.canvas_size[1] - image_height_on_canvas) / 2
        
        # Convert canvas coordinates to image coordinates
        image_x = int((canvas_x - offset_x) / scale)
        image_y = int((canvas_y - offset_y) / scale)
        
        # Ensure coordinates are within image bounds
        image_x = max(0, min(image_x, self.original_size[0]))
        image_y = max(0, min(image_y, self.original_size[1]))
        
        # Add or update corner position
        if len(self.transformation_corners) < 4:
            self.transformation_corners.append((image_x, image_y))
        else:
            self.transformation_corners[self.current_corner] = (image_x, image_y)
        
        # Update current corner index
        self.current_corner = (self.current_corner + 1) % 4
        
        # Print corner positions
        print(f"Corner {self.current_corner} set to: ({image_x}, {image_y})")
        print("Current corners:", self.transformation_corners)
        
        # Update the display
        self.update_output_image()

if __name__ == "__main__":
    root = tk.Tk()
    app = ImageEditor(root)
    root.mainloop()

