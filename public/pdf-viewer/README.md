# PDF Viewer with Adobe Commenting

## Purpose
Embeds PDF documents from Azure Blob Storage with Adobe PDF Embed API, enabling commenting and annotation features.

## URL
`https://powernode.wippli.ai/pdf-viewer/`

## Usage
```
https://powernode.wippli.ai/pdf-viewer/?pdf=<URL>&name=<filename>
```

### Parameters
- `pdf` (required): URL-encoded PDF file URL from Azure Blob Storage
- `name` (optional): Display name for the PDF (defaults to "document.pdf")

### Example
```
https://powernode.wippli.ai/pdf-viewer/?pdf=https%3A%2F%2Fwipplipdfgen.blob.core.windows.net%2Fprologistik-wippli-999%2Fquestionnaire-test.pdf&name=questionnaire-test.pdf
```

## Features
- Adobe PDF Embed API with full commenting support
- Annotation tools enabled
- Download button
- Prologistik HUB branding

## Configuration
- **Adobe Client ID**: `edeb93a6c51c4b1abd9c3d0001a784f2`
- **Registered Domain**: `powernode.wippli.ai` (enables commenting)
- **Embed Mode**: `SIZED_CONTAINER`
- **Tools Enabled**: Download, Print, Annotations, Comments

## Integration
Used by n8n workflow **Neo_Responder** (ID: `Sp3MEuApPwENz2wO`) in the `merge all` node to display PDFs in WipBoard with commenting enabled.

## Why PowerNode Domain?
Adobe PDF Embed API requires the viewer to run on a registered domain (`*.wippli.ai`) to enable commenting features. Hosting on blob storage disables commenting.

---
Generated: 2025-12-05
