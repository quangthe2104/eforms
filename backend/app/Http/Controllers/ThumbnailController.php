<?php

namespace App\Http\Controllers;

use App\Models\Form;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\File;

class ThumbnailController extends Controller
{
    /**
     * Upload form thumbnail
     */
    public function upload(Request $request, Form $form)
    {
        // Check ownership
        if ($form->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'thumbnail' => 'required|string', // Base64 image data
        ]);

        try {
            // Decode base64 image
            $imageData = $request->thumbnail;
            
            // Remove data:image/...;base64, prefix if exists
            if (strpos($imageData, 'data:image') === 0) {
                $imageData = preg_replace('/^data:image\/\w+;base64,/', '', $imageData);
            }
            
            $imageData = base64_decode($imageData);
            
            if ($imageData === false) {
                return response()->json(['message' => 'Invalid image data'], 400);
            }

            // Delete old thumbnail if exists
            if ($form->thumbnail) {
                $oldPath = base_path('storage/thumbnails/' . basename($form->thumbnail));
                if (File::exists($oldPath)) {
                    File::delete($oldPath);
                }
            }

            // Generate unique filename
            $filename = Str::random(40) . '.jpg';
            $thumbnailPath = base_path('storage/thumbnails');
            
            // Ensure directory exists
            if (!File::exists($thumbnailPath)) {
                File::makeDirectory($thumbnailPath, 0755, true);
            }
            
            // Save to storage/thumbnails folder at project root
            $fullPath = $thumbnailPath . '/' . $filename;
            File::put($fullPath, $imageData);
            
            // Update form with relative path for database
            $relativePath = 'storage/thumbnails/' . $filename;
            $form->update(['thumbnail' => $relativePath]);

            // Return full URL
            $thumbnailUrl = url('storage/thumbnails/' . $filename);

            return response()->json([
                'message' => 'Thumbnail uploaded successfully',
                'thumbnail' => $thumbnailUrl,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to upload thumbnail',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}

