import tkinter as tk
import os
from tkinter import filedialog
from PIL import Image, ImageTk
from apng import APNG
import numpy as np
import math

# Constants
DEFAULT_FRAME_COUNT = 15
MIN_SCALE = 0.1
MAX_SCALE = 0.8
SCALE_RESOLUTION = 0.01

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

        self.setup_ui()
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
    

        # Sliders for scaling and origin positions
        self.scale_slider = tk.Scale(controls_frame, from_=MIN_SCALE, to_=MAX_SCALE, resolution=SCALE_RESOLUTION, orient=tk.HORIZONTAL, label="Box Scale", bg=self.root.cget('bg'), highlightthickness=0)
        self.scale_slider.pack(side=tk.LEFT, padx=5)
        self.scale_slider.bind("<Motion>", self.update_transform)

        self.origin_x_slider = tk.Scale(controls_frame, from_=0, to_=1, resolution=0.01, orient=tk.HORIZONTAL, label="Origin X", bg=self.root.cget('bg'), highlightthickness=0)
        self.origin_x_slider.pack(side=tk.LEFT, padx=5)
        self.origin_x_slider.bind("<Motion>", self.update_transform)

        self.origin_y_slider = tk.Scale(controls_frame, from_=0, to_=1, resolution=0.01, orient=tk.HORIZONTAL, label="Origin Y", bg=self.root.cget('bg'), highlightthickness=0)
        self.origin_y_slider.pack(side=tk.LEFT, padx=5)
        self.origin_y_slider.bind("<Motion>", self.update_transform)

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
                self.calculate_scale_factor()
                self.update_transform(None)
        except Exception as e:
            print(f"Error loading image: {e}")

    def calculate_scale_factor(self):
        if self.image and self.canvas_size != (0, 0):
            width_ratio = self.canvas_size[0] / self.original_size[0]
            height_ratio = self.canvas_size[1] / self.original_size[1]
            self.scale_factor = min(width_ratio, height_ratio)

    def update_transform(self, event):
        if not self.image:
            return

        # Clear previous drawings
        if self.canvas is not None:
            self.canvas.delete("all")
        self.image_references.clear()

        # Get slider values
        scale = self.scale_slider.get()
        self.origin_x = self.origin_x_slider.get()
        self.origin_y = self.origin_y_slider.get()
        
        # Calculate Original image origin coordinates
        self.original_origin_x = self.origin_x * self.original_size[0]
        self.original_origin_y = self.origin_y * self.original_size[1]
        
        current_scale = 1.0
        iteration = 0

        # Continue drawing images while their size is above a minimum threshold
        while True:
            # Calculate size of each image
            canvas_width = self.original_size[0] * current_scale * self.scale_factor
            canvas_height = self.original_size[1] * current_scale * self.scale_factor

            # Ensure dimensions are positive and not too small
            if canvas_width < 1 or canvas_height < 1:
                break  # Stop if the images become too small

            # Calculate origin position for each image
            origin_x_pos = (self.canvas_size[0] - canvas_width) * self.origin_x
            origin_y_pos = (self.canvas_size[1] - canvas_height) * self.origin_y

            # Create scaled image
            scaled_image = self.image.resize((int(canvas_width), int(canvas_height)), Image.Resampling.LANCZOS)
            tk_scaled_image = ImageTk.PhotoImage(scaled_image)

            # Draw the image on the canvas
            if self.image_stack_on_top:
                self.canvas.create_image(origin_x_pos, origin_y_pos, image=tk_scaled_image, anchor=tk.NW, tags=f"image{iteration}")
            else:
                self.canvas.create_image(origin_x_pos, origin_y_pos, image=tk_scaled_image, anchor=tk.NW, tags=f"image{iteration}")
                self.canvas.tag_lower(f"image{iteration}")

            # Store reference to avoid garbage collection
            self.image_references.append(tk_scaled_image)

            # Update scaling for the next image
            current_scale *= scale
            iteration += 1

        # Update the output image (using original size)
        self.update_output_image()

    def update_output_image(self):
        if self.output_image:
            self.output_image.close()
        self.output_image = Image.new("RGBA", self.original_size, (255, 255, 255, 0))

        current_scale = 1.0
        images_to_paste = []

        while True:
            canvas_width = self.original_size[0] * current_scale
            canvas_height = self.original_size[1] * current_scale

            if canvas_width < 1 or canvas_height < 1:
                break

            origin_x_pos = int((self.original_size[0] - canvas_width) * self.origin_x)
            origin_y_pos = int((self.original_size[1] - canvas_height) * self.origin_y)

            scaled_image = self.image.resize((int(canvas_width), int(canvas_height)), Image.Resampling.LANCZOS)

            images_to_paste.append((scaled_image, (origin_x_pos, origin_y_pos)))

            current_scale *= self.scale_slider.get()

        if self.image_stack_on_top:
            for scaled_image, position in images_to_paste:
                self.output_image.paste(scaled_image, position, scaled_image)
        else:
            for scaled_image, position in reversed(images_to_paste):
                self.output_image.paste(scaled_image, position, scaled_image)

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
        self.update_transform(None)



    def resize_image(self):
        
        #Clear Previous output
        self.enlarged_image = None
        self.enlarged_image_size = None
        self.enlarged_origin_x = 0
        self.enlarged_origin_y = 0

        
        if not self.output_image:
            print("No output image available to resize.")
            return

        # Calculate the scaling factor for enlargement
        scale = self.scale_slider.get()
        inverse_scale = 1.0 / scale

        # New size for the enlarged image
        self.enlarged_image_size = (int(self.original_size[0] * inverse_scale), int(self.original_size[1] * inverse_scale))
        self.enlarged_image = self.output_image.resize(self.enlarged_image_size, Image.Resampling.LANCZOS)

        # Calculate new origin coordinates
        self.enlarged_origin_x = (self.enlarged_image_size[0] * self.origin_x) - (self.original_size[0] * self.origin_x)
        self.enlarged_origin_y = (self.enlarged_image_size[1] * self.origin_y) - (self.original_size[1] * self.origin_y)
        print(f"Enlarged Origin Coordinates: ({self.enlarged_origin_x}, {self.original_origin_y})")

        #Paste on Enlarged image
        if not self.enlarged_image or not self.output_image:
            print("No enlarged or output image available for pasting.")
            return

        # Create a copy of the enlarged image to paste the output image onto
        enlarged_image_copy = self.enlarged_image.copy()
        
        if self.image_stack_on_top:
            # Paste the output image onto the enlarged image at the new origin
            enlarged_image_copy.paste(self.output_image, (int(self.enlarged_origin_x), int(self.enlarged_origin_y)), self.output_image)

            # Update the enlarged image with the pasted result
            self.enlarged_image = enlarged_image_copy
        else:
            enlarged_image_copy_2 = self.enlarged_image.copy()
            # Paste the output image onto the enlarged image at the new origin
            enlarged_image_copy.paste(self.output_image, (int(self.enlarged_origin_x), int(self.enlarged_origin_y)), self.output_image)
            
            enlarged_image_copy.paste(enlarged_image_copy_2, (0,0), enlarged_image_copy_2)


            # Update the enlarged image with the pasted result
            self.enlarged_image = enlarged_image_copy


    def create_zoom_frames(self):
        #clear previous frames
        self.frames.clear()

        
        # Fill the foreground with copies
        self.resize_image()

        if not self.enlarged_image:
            print("No enlarged image available after resizing.")
            return

        # Crop the enlarged image
        self.enlarged_image = self.enlarged_image.crop((self.enlarged_origin_x, self.enlarged_origin_y, self.enlarged_origin_x + self.original_size[0], self.enlarged_origin_y + self.original_size[1]))
        
        # Resize enlarged_image to match the original size
        self.enlarged_image = self.enlarged_image.resize(self.original_size, Image.Resampling.LANCZOS)
        print(f"Enlarged image - Resized to original size.")
        
        self.output_image = self.enlarged_image

        # Clear parameters
        self.enlarged_image = None
        self.enlarged_image_size = None
        
        # Call resize_image
        self.resize_image()
        print("Resized image created for APNG.")
        
        if not self.enlarged_image:
            print("No enlarged image available to create APNG.")
            return

        # Get slider values for zoom
        scale = self.scale_slider.get()
        origin_x = self.origin_x_slider.get()
        origin_y = self.origin_y_slider.get()

        # Get frame_count from the textbox
        frame_count_str = self.frame_count_entry.get()
        try:
            frame_count = int(frame_count_str)
        except ValueError:
            print("Invalid frame count. Please enter a valid number.")
            return

        # Define parameters for APNG
        num_frames = frame_count  # Remove the +2, we'll create exactly the number of frames specified

        print(f"Enlarged Image Size: {self.enlarged_image_size}")
        print(f"Original Image Size: {self.original_size}")

        # Calculate the total scale change
        start_scale = 1.0
        end_scale = self.enlarged_image_size[0] / self.original_size[0]

        # Create each frame of the APNG
        for i in range(num_frames):
            # Calculate the exponential scale factor
            t = i / num_frames  # Changed from (num_frames - 1) to num_frames
            current_scale = start_scale * math.exp(t * math.log(end_scale / start_scale))

            # Calculate the frame size
            frame_size = (
                int(self.original_size[0] * current_scale),
                int(self.original_size[1] * current_scale)
            )
            print(f"Frame {i} - Frame Size: {frame_size}")

            # Check if the frame size is valid (non-zero, within enlarged image bounds)
            if frame_size[0] <= 0 or frame_size[1] <= 0 or frame_size[0] > self.enlarged_image_size[0] or frame_size[1] > self.enlarged_image_size[1]:
                print(f"Frame {i} - Invalid frame size: {frame_size}. Skipping frame.")
                continue

            # Calculate origin for cropping
            crop_x = int((self.enlarged_image_size[0] - frame_size[0]) * self.origin_x)
            crop_y = int((self.enlarged_image_size[1] - frame_size[1]) * self.origin_y)
            print(f"Frame {i} - Crop Coordinates: ({crop_x}, {crop_y})")

            # Check if cropping coordinates are valid
            if crop_x < 0 or crop_y < 0 or crop_x + frame_size[0] > self.enlarged_image_size[0] or crop_y + frame_size[1] > self.enlarged_image_size[1]:
                print(f"Frame {i} - Invalid crop coordinates: ({crop_x}, {crop_y}, {crop_x + frame_size[0]}, {crop_y + frame_size[1]})")
                print(f"Enlarged Image Size: {self.enlarged_image_size}. Skipping frame.")
                continue

            # Crop the enlarged image to the current frame size
            frame_image = self.enlarged_image.crop((crop_x, crop_y, crop_x + frame_size[0], crop_y + frame_size[1]))
            print(f"Frame {i} - Cropped successfully.")

            # Resize frame image to match the original size
            frame_image = frame_image.resize(self.original_size, Image.Resampling.LANCZOS)
            print(f"Frame {i} - Resized to original size.")

            # Save each frame as PNG for APNG creation
            frame_path = f"frame_{i}.png"
            frame_image.save(frame_path)
            print(f"Frame {i} saved as {frame_path}.")
            self.frames.append(frame_path)
            print(f"Total frames so far: {len(self.frames)}")

        if len(self.frames) == 0:
            print("No valid frames were created. Cannot save APNG.")
            return  # Exit if no frames were created

    def delete_frames(self):
        for frame_path in self.frames:
            try:
                os.remove(frame_path)
                print(f"{frame_path} removed")
            except Exception as e:
                print(f"Error removing {frame_path}: {e}")

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
                for frame_path in frame_list:
                    apng.append_file(frame_path, delay=1)
                apng.save(file_path)
                print(f"Zoom APNG saved as {file_path}")
            else:
                print("No file path provided. APNG not saved.")
        except Exception as e:
            print(f"Error saving APNG: {e}")
        finally:
            self.delete_frames()

    def save_apng_zoom_in(self):
        self.save_apng(zoom_in=True)

    def save_apng_zoom_out(self):
        self.save_apng(zoom_in=False)

    def save_gif_zoom_in(self):
        #create the frames
        self.create_zoom_frames()
        
        print(f"Total frames to save: {len(self.frames)}")


        if not self.frames:  # Check if frames are available
            print("No frames created. Cannot save GIF.")
            return


        # Save the frames as GIF
        file_path = filedialog.asksaveasfilename(defaultextension=".gif", filetypes=[("GIF Files", "*.gif")])
        os.makedirs(os.path.dirname(file_path), exist_ok=True)

        if file_path:
            images = [Image.open(frame_path) for frame_path in self.frames]
            images[0].save(file_path, save_all=True, append_images=images[1:], duration=100, loop=0)
            print(f"\n\n\n\n\n\n\n\nGIF saved as {file_path}\n\n\n\n\n\n\n\n\n\n")
        else:
            print("No file path provided. GIF not saved.")
            
        self.delete_frames()

    def save_gif_zoom_out(self):
        #create the frames
        self.create_zoom_frames()
        
        print(f"Total frames to save: {len(self.frames)}")


        if not self.frames:  # Check if frames are available
            print("No frames created. Cannot save GIF.")
            return


        # Save the frames as GIF
        file_path = filedialog.asksaveasfilename(defaultextension=".gif", filetypes=[("GIF Files", "*.gif")])
        os.makedirs(os.path.dirname(file_path), exist_ok=True)

        if file_path:
            images = [Image.open(frame_path) for frame_path in reversed(self.frames)]
            images[0].save(file_path, save_all=True, append_images=images[1:], duration=100, loop=0)
            print(f"\n\n\n\n\n\n\n\nGIF saved as {file_path}\n\n\n\n\n\n\n\n\n\n")
        else:
            print("No file path provided. GIF not saved.")
            
        self.delete_frames()

        self.delete_frames()

    def on_canvas_resize(self, event):
        self.canvas_size = (event.width, event.height)
        self.calculate_scale_factor()
        self.update_transform(None)

if __name__ == "__main__":
    root = tk.Tk()
    app = ImageEditor(root)
    root.mainloop()

