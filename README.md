# Cadence SKILL Pixel Array Layout Generator

A modern, web-based utility for VLSI/Layout Engineers to automatically generate Cadence SKILL code from Excel-based pixel array layout specifications.

This application allows you to upload an Excel file defining your row block types, segments, cell mappings, and pitches. It then instantly renders a precise 2D visualization of your layout and generates the corresponding SKILL scripts to build the mosaic array in Cadence Virtuoso.

**Author:** Yongkai Zhang
**Copyright:** (c) 2026 Yongkai Zhang

## Features

- 📊 **Excel Parsing:** Easily read complex layout formats containing `format_template` and `pix_tbl` sheets.
- 📐 **Interactive 2D Canvas Visualization:** Preview your pixel layout with drag-to-pan, zoom, scale rulers, and exact cell dimension ratios.
- 💾 **Export Layout Visuals:** Download the rendered view as an SVG or a High-Resolution PNG.
- 💻 **SKILL Script Generation:** Produces robust, ready-to-execute Cadence SKILL (`.il`) code. Uses `dbCreateSimpleMosaic`.
- 🐍 **Python Generator Option:** Need to parse the Excel directly in your shell? The app also generates a standalone Python script to convert your Excel sheet to SKILL on the fly.
- 🎨 **Modern Minimalist UI:** Crafted with React, Tailwind CSS, and precise architectural design.

## How to Use

1. **Upload your Excel Spec:** Use the drag-and-drop zone or click to upload your `.xlsx` configuration file. If you don't have one, click **Download Template** to get started.
2. **Review the Visualization:** The application will instantly parse your file and display the pixel array. You can zoom in and inspect the rows, padding columns, ROV (Region of Validation) markers, and dummy cells.
3. **Download Code:**
   - Click **Download SKILL Code** to get the `.il` file ready for Cadence Virtuoso.
   - Click **Download Python Code** to get a standalone parser.
4. **Export Image:**
   - Click **SVG** or **PNG** to download high-resolution captures of your current layout visualization.

## Cell orientation and placement

Set `rotation` in the `pix_tbl` sheet or edit the Rotation selector in Cell Mapping.
Each purpose uses its own orientation: `R0`, `R90`, `R180`, `R270`, `MX`, `MY`,
`MXR90`, or `MYR90`. Empty rotations default to `R0`; Excel imports normalize
case and reject unsupported values. Existing workbooks with `R0` now generate
unrotated cells. Set `R180` explicitly where the previous forced rotation is needed.

Both the browser SKILL export and the corrected standalone Python export honor
these settings. Origin offsets account for rotation and reflection; quarter turns
swap local mosaic counts and pitches to preserve the requested logical grid.
Pitch specifies the distance between cell origins, independently of cell size.
Placement uses the measured centering-layer bounds of each master, or its master
bounding box if that layer is absent, so offset local origins and rotations align
with their logical grid slots. Shapes larger than pitch can overlap; smaller
shapes leave gaps. The browser previews nominal pitch envelopes because physical
master geometry is available only inside Virtuoso.
Rows follow the same reversed configuration order used by the preview.

Centering selects the largest row containing the configured ROV purpose (or an
active row when that purpose is absent), and centers its target-layer bounds at
`(0, 0)`. For segmented rows, the union of every matching target segment is centered,
excluding other purposes from the bounds calculation. With no marker, selection
uses the largest active block, or the entire pitch envelope if none exists.
Verification rectangles are drawn on **M1 pin**; the configured centering layer
is only measured, never used for marker output. Rectangles use each mosaic's saved orientation and only reuse bounds for the same
library and cell. Generated verification rectangles are tagged and removed on
reruns; untagged shapes are retained.

Excel export preserves logical purpose keys separately from display names. The
`rov purpose` metadata preserves targets that occur only in padding segments;
legacy workbooks can continue using the ROV marker column.
Imports reject malformed/fractional counts, nonfinite pitches, missing cell
mappings, and conflicting ROV purposes rather than guessing physical cells.
The row table is ordered **top to bottom**.

## Development Setup

The project is built using modern frontend tooling:
- **React 19**
- **Vite**
- **Tailwind CSS v4**
- **TypeScript**

### Requirements
- Node.js (v18 or higher recommended)
- npm or yarn

### Installation
1. Clone the repository or download the source code.
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally
Start the development server. The app will be available at `http://localhost:3000`.
```bash
npm run dev
```

## Deployment

This application is a Client-Side Single Page Application (SPA). It can be deployed statically to any web server or hosting platform such as Vercel, Netlify, GitHub Pages, or Google Cloud Run.

### Building for Production
To build the application, run:
```bash
npm run build
```
This command compiles the TypeScript code, bundles the application with Vite, and outputs optimized static files into the `dist/` directory.

### Deploying the `dist/` directory
You can deploy the contents of the `dist/` folder to any static hosting service.

**Example: Deploying to Vercel/Netlify**
1. Connect your Git repository.
2. Set the build command to `npm run build`.
3. Set the output directory to `dist/`.

**Example: Deploying via Docker (Nginx)**
If you want to host it yourself, you can serve the `dist/` folder using Nginx:
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Troubleshooting (Cadence Virtuoso)

If you face any issues executing the generated SKILL script in Cadence:
- Ensure that the cell and library names mapped in your `pix_tbl` exactly match the names in your Cadence environment.
- The script uses `dbCreateSimpleMosaic`. Ensure you load the script inside a `layout` view, or run `createPixelArray()` from your CIW.

---
*Crafted for precision automation.*
