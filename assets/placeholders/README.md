# Placeholder Assets

This directory contains placeholder images for the EliteMC platform.

## Property Images

For development, the application uses Unsplash URLs for property images.

In production, replace these with actual property photos stored in Supabase Storage.

## Recommended Image Sizes

- **Property Listings**: 800x600px
- **Property Detail**: 1200x800px
- **Thumbnails**: 400x300px

## Adding Real Images

1. Upload to Supabase Storage bucket: `property-images`
2. Update property records with storage URLs
3. Example URL: `https://your-project.supabase.co/storage/v1/object/public/property-images/property-001.jpg`

## Example Placeholder

You can use this path in your HTML for local placeholder:
```html
<img src="/assets/placeholders/property.jpg" alt="Property" onerror="this.src='https://via.placeholder.com/800x600/6366f1/ffffff?text=Property+Image'">
```

This ensures images gracefully fall back to a placeholder if not found.
