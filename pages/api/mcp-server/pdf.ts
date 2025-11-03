import type { NextApiRequest, NextApiResponse } from 'next';
import { BlobServiceClient } from '@azure/storage-blob';
import Anthropic from '@anthropic-ai/sdk';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { TableClient } from '@azure/data-tables';

// Adobe PDF Services (optional - only if credentials provided)
let adobeAvailable = false;
let PDFServices: any = null;
let Credentials: any = null;
let ExtractPDFParams: any = null;
let ExtractElementType: any = null;
let ExtractPDFJob: any = null;
let ExtractPDFResult: any = null;
let MimeType: any = null;

try {
  if (process.env.ADOBE_PDF_CLIENT_ID && process.env.ADOBE_PDF_CLIENT_SECRET) {
    const adobeSDK = require('@adobe/pdfservices-node-sdk');
    PDFServices = adobeSDK.PDFServices;
    Credentials = adobeSDK.Credentials;
    ExtractPDFParams = adobeSDK.ExtractPDFParams;
    ExtractElementType = adobeSDK.ExtractElementType;
    ExtractPDFJob = adobeSDK.ExtractPDFJob;
    ExtractPDFResult = adobeSDK.ExtractPDFResult;
    MimeType = adobeSDK.MimeType;
    adobeAvailable = true;
    console.log('Adobe PDF Services enabled');
  }
} catch (error) {
  console.log('Adobe PDF Services not available, using pdf-lib only');
}

/**
 * PDF MCP Server - Hybrid Architecture (pdf-lib + Adobe PDF Services)
 *
 * COMPREHENSIVE PDF TOOL SUITE (12 core tools):
 *
 * 1. create_pdf - Create PDFs with text and formatting
 * 2. get_pdf_info - Read PDF metadata
 * 3. list_pdfs - List PDFs in storage
 * 4. delete_pdf - Delete PDFs
 * 5. get_pdf_url - Get temporary download URLs
 * 6. copy_pdf - Duplicate PDFs
 * 7. merge_pdfs - Combine multiple PDFs
 * 8. split_pdf - Split PDF by page range
 * 9. add_text - Add text to existing PDF
 * 10. read_pdf - Read PDF content and metadata
 * 11. extract_text - Extract text (Adobe AI-powered if available)
 * 12. analyze_pdf - AI-powered PDF analysis with Claude
 */

// Initialize clients
let blobServiceClient: BlobServiceClient | null = null;
let anthropicClient: Anthropic | null = null;
let pdfServicesClient: any = null;

const CONTAINER_NAME = process.env.DEFAULT_CONTAINER || 'wippli-documents';

function getBlobClient() {
  if (!blobServiceClient) {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING not set');
    }
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  }
  return blobServiceClient;
}

function getAnthropicClient() {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

function getPDFServicesClient() {
  if (!adobeAvailable) {
    throw new Error('Adobe PDF Services not configured');
  }
  if (!Credentials || !PDFServices) {
    throw new Error('Adobe SDK classes not loaded');
  }
  if (!pdfServicesClient) {
    console.log('Creating Adobe PDF Services client...');
    console.log('CLIENT_ID present:', !!process.env.ADOBE_PDF_CLIENT_ID);
    console.log('CLIENT_SECRET present:', !!process.env.ADOBE_PDF_CLIENT_SECRET);
    const credentials = Credentials
      .servicePrincipalCredentialsBuilder()
      .withClientId(process.env.ADOBE_PDF_CLIENT_ID!)
      .withClientSecret(process.env.ADOBE_PDF_CLIENT_SECRET!)
      .build();
    pdfServicesClient = new PDFServices({ credentials });
    console.log('Adobe PDF Services client created:', !!pdfServicesClient);
    console.log('Client type:', typeof pdfServicesClient);
    console.log('Client has upload method:', typeof pdfServicesClient?.upload);
  }
  if (!pdfServicesClient) {
    throw new Error('Failed to create PDF Services client');
  }
  return pdfServicesClient;
}

async function getPowerNodeConfig(): Promise<{ model: string; apiKey: string } | null> {
  try {
    const connectionString = process.env.POWERNODE_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      return null;
    }
    const tableClient = TableClient.fromConnectionString(connectionString, 'powerNodeConfig');
    const config = await tableClient.getEntity('config', 'default');
    return {
      model: (config.aiModel as string) || 'claude-3-5-sonnet-20241022',
      apiKey: (config.anthropicApiKey as string) || process.env.ANTHROPIC_API_KEY || ''
    };
  } catch (error) {
    return null;
  }
}

async function streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    readableStream.on('data', (chunk: Buffer) => chunks.push(chunk));
    readableStream.on('end', () => resolve(Buffer.concat(chunks)));
    readableStream.on('error', reject);
  });
}

const TOOLS = [
  {
    name: 'create_pdf',
    description: 'Create a new PDF document with text and formatting',
    inputSchema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'PDF filename (without .pdf)' },
        title: { type: 'string', description: 'Document title (optional)' },
        author: { type: 'string', description: 'Document author (optional)' },
        content: { type: 'string', description: 'Initial text content (optional)' }
      },
      required: ['filename']
    }
  },
  {
    name: 'get_pdf_info',
    description: 'Get PDF metadata (pages, size, author, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'PDF filename (.pdf file)' }
      },
      required: ['filename']
    }
  },
  {
    name: 'list_pdfs',
    description: 'List all PDF files in storage',
    inputSchema: {
      type: 'object',
      properties: {
        prefix: { type: 'string', description: 'Optional filename prefix filter' }
      }
    }
  },
  {
    name: 'delete_pdf',
    description: 'Delete a PDF from storage',
    inputSchema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'PDF filename to delete' }
      },
      required: ['filename']
    }
  },
  {
    name: 'get_pdf_url',
    description: 'Get temporary download URL (1 hour)',
    inputSchema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'PDF filename' }
      },
      required: ['filename']
    }
  },
  {
    name: 'copy_pdf',
    description: 'Copy/duplicate a PDF',
    inputSchema: {
      type: 'object',
      properties: {
        sourceFilename: { type: 'string', description: 'Source PDF' },
        targetFilename: { type: 'string', description: 'Target PDF (without .pdf)' }
      },
      required: ['sourceFilename', 'targetFilename']
    }
  },
  {
    name: 'merge_pdfs',
    description: 'Merge multiple PDFs into one',
    inputSchema: {
      type: 'object',
      properties: {
        sourceFilenames: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of PDF filenames to merge'
        },
        targetFilename: { type: 'string', description: 'Target PDF (without .pdf)' }
      },
      required: ['sourceFilenames', 'targetFilename']
    }
  },
  {
    name: 'split_pdf',
    description: 'Split PDF by page range',
    inputSchema: {
      type: 'object',
      properties: {
        sourceFilename: { type: 'string', description: 'Source PDF' },
        targetFilename: { type: 'string', description: 'Target PDF (without .pdf)' },
        startPage: { type: 'number', description: 'Start page (1-indexed)' },
        endPage: { type: 'number', description: 'End page (1-indexed)' }
      },
      required: ['sourceFilename', 'targetFilename', 'startPage', 'endPage']
    }
  },
  {
    name: 'add_text',
    description: 'Add text to existing PDF',
    inputSchema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'PDF filename' },
        text: { type: 'string', description: 'Text to add' },
        pageNumber: { type: 'number', description: 'Page number (1-indexed)' },
        x: { type: 'number', description: 'X coordinate (default: 50)' },
        y: { type: 'number', description: 'Y coordinate (default: 50)' },
        fontSize: { type: 'number', description: 'Font size (default: 12)' }
      },
      required: ['filename', 'text']
    }
  },
  {
    name: 'read_pdf',
    description: 'Read PDF content and metadata',
    inputSchema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'PDF filename' }
      },
      required: ['filename']
    }
  },
  {
    name: 'extract_text',
    description: 'Extract text from PDF (AI-powered if Adobe available)',
    inputSchema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'PDF filename' }
      },
      required: ['filename']
    }
  },
  {
    name: 'analyze_pdf',
    description: 'AI-powered PDF analysis with Claude',
    inputSchema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'PDF filename' },
        prompt: { type: 'string', description: 'Analysis request' }
      },
      required: ['filename', 'prompt']
    }
  }
];

// Tool implementations

async function createPDF(args: any): Promise<string> {
  const { filename, title, author, content } = args;

  const pdfDoc = await PDFDocument.create();
  if (title) pdfDoc.setTitle(title);
  if (author) pdfDoc.setAuthor(author);
  pdfDoc.setCreator('PowerNode PDF MCP');
  pdfDoc.setCreationDate(new Date());

  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();

  if (content || title) {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    let y = height - 50;

    if (title) {
      page.drawText(title, { x: 50, y, size: 24, font: boldFont, color: rgb(0, 0, 0) });
      y -= 40;
    }

    if (content) {
      const lines = content.split('\n');
      for (const line of lines) {
        if (y < 50) break;
        page.drawText(line, { x: 50, y, size: 12, font, color: rgb(0, 0, 0) });
        y -= 20;
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  const buffer = Buffer.from(pdfBytes);

  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(CONTAINER_NAME);
  const fullFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  const blockBlobClient = containerClient.getBlockBlobClient(fullFilename);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: 'application/pdf' }
  });

  return `PDF created: ${fullFilename} (${pdfDoc.getPageCount()} pages, ${buffer.length} bytes)`;
}

async function getPDFInfo(args: any): Promise<string> {
  const { filename } = args;

  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(CONTAINER_NAME);
  const blockBlobClient = containerClient.getBlockBlobClient(filename);

  const downloadResponse = await blockBlobClient.download();
  const buffer = await streamToBuffer(downloadResponse.readableStreamBody!);

  const pdfDoc = await PDFDocument.load(buffer);

  const info = {
    filename,
    pageCount: pdfDoc.getPageCount(),
    fileSize: buffer.length,
    fileSizeFormatted: `${(buffer.length / 1024).toFixed(2)} KB`,
    title: pdfDoc.getTitle() || 'N/A',
    author: pdfDoc.getAuthor() || 'N/A',
    subject: pdfDoc.getSubject() || 'N/A',
    creator: pdfDoc.getCreator() || 'N/A',
    producer: pdfDoc.getProducer() || 'N/A',
    creationDate: pdfDoc.getCreationDate()?.toISOString() || 'N/A'
  };

  return JSON.stringify(info, null, 2);
}

async function listPDFs(args: any): Promise<string> {
  const { prefix = '' } = args;

  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(CONTAINER_NAME);

  const pdfs: any[] = [];

  for await (const blob of containerClient.listBlobsFlat({ prefix })) {
    if (blob.name.toLowerCase().endsWith('.pdf') && !blob.name.startsWith('templates/')) {
      pdfs.push({
        name: blob.name,
        size: `${((blob.properties.contentLength || 0) / 1024).toFixed(2)} KB`,
        lastModified: blob.properties.lastModified?.toISOString()
      });
    }
  }

  return pdfs.length === 0 ? 'No PDFs found' : `Found ${pdfs.length} PDF(s):\n${JSON.stringify(pdfs, null, 2)}`;
}

async function deletePDF(args: any): Promise<string> {
  const { filename } = args;

  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(CONTAINER_NAME);
  const blockBlobClient = containerClient.getBlockBlobClient(filename);

  await blockBlobClient.delete();
  return `Deleted: ${filename}`;
}

async function getPDFUrl(args: any): Promise<string> {
  const { filename } = args;

  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(CONTAINER_NAME);
  const blockBlobClient = containerClient.getBlockBlobClient(filename);

  const expiresOn = new Date();
  expiresOn.setHours(expiresOn.getHours() + 1);

  const url = await blockBlobClient.generateSasUrl({
    permissions: { read: true } as any,
    expiresOn
  });

  return `URL (1 hour):\n${url}`;
}

async function copyPDF(args: any): Promise<string> {
  const { sourceFilename, targetFilename } = args;

  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(CONTAINER_NAME);

  const sourceBlob = containerClient.getBlockBlobClient(sourceFilename);
  const fullTarget = targetFilename.endsWith('.pdf') ? targetFilename : `${targetFilename}.pdf`;
  const targetBlob = containerClient.getBlockBlobClient(fullTarget);

  await targetBlob.beginCopyFromURL(sourceBlob.url);
  return `Copied: ${sourceFilename} → ${fullTarget}`;
}

async function mergePDFs(args: any): Promise<string> {
  const { sourceFilenames, targetFilename } = args;

  if (sourceFilenames.length < 2) {
    throw new Error('At least 2 PDFs required for merging');
  }

  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(CONTAINER_NAME);

  const mergedPdf = await PDFDocument.create();

  for (const source of sourceFilenames) {
    const blob = containerClient.getBlockBlobClient(source);
    const download = await blob.download();
    const buffer = await streamToBuffer(download.readableStreamBody!);
    const pdf = await PDFDocument.load(buffer);
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    pages.forEach(page => mergedPdf.addPage(page));
  }

  const bytes = await mergedPdf.save();
  const fullTarget = targetFilename.endsWith('.pdf') ? targetFilename : `${targetFilename}.pdf`;
  const targetBlob = containerClient.getBlockBlobClient(fullTarget);

  await targetBlob.uploadData(Buffer.from(bytes), {
    blobHTTPHeaders: { blobContentType: 'application/pdf' }
  });

  return `Merged ${sourceFilenames.length} PDFs → ${fullTarget} (${mergedPdf.getPageCount()} pages)`;
}

async function splitPDF(args: any): Promise<string> {
  const { sourceFilename, targetFilename, startPage, endPage } = args;

  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(CONTAINER_NAME);

  const sourceBlob = containerClient.getBlockBlobClient(sourceFilename);
  const download = await sourceBlob.download();
  const buffer = await streamToBuffer(download.readableStreamBody!);

  const sourcePdf = await PDFDocument.load(buffer);
  const totalPages = sourcePdf.getPageCount();

  if (startPage < 1 || endPage > totalPages || startPage > endPage) {
    throw new Error(`Invalid range: ${startPage}-${endPage}. PDF has ${totalPages} pages`);
  }

  const newPdf = await PDFDocument.create();
  const indices = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage - 1 + i);
  const pages = await newPdf.copyPages(sourcePdf, indices);
  pages.forEach(page => newPdf.addPage(page));

  const bytes = await newPdf.save();
  const fullTarget = targetFilename.endsWith('.pdf') ? targetFilename : `${targetFilename}.pdf`;
  const targetBlob = containerClient.getBlockBlobClient(fullTarget);

  await targetBlob.uploadData(Buffer.from(bytes), {
    blobHTTPHeaders: { blobContentType: 'application/pdf' }
  });

  return `Split pages ${startPage}-${endPage} → ${fullTarget} (${newPdf.getPageCount()} pages)`;
}

async function addText(args: any): Promise<string> {
  const { filename, text, pageNumber, x = 50, y = 50, fontSize = 12 } = args;

  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(CONTAINER_NAME);
  const blob = containerClient.getBlockBlobClient(filename);

  const download = await blob.download();
  const buffer = await streamToBuffer(download.readableStreamBody!);

  const pdfDoc = await PDFDocument.load(buffer);
  const pages = pdfDoc.getPages();
  const page = pageNumber ? pages[pageNumber - 1] : pages[pages.length - 1];

  if (!page) throw new Error(`Page ${pageNumber || pages.length} not found`);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText(text, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });

  const bytes = await pdfDoc.save();
  await blob.uploadData(Buffer.from(bytes), {
    blobHTTPHeaders: { blobContentType: 'application/pdf' }
  });

  return `Text added to ${filename} at (${x}, ${y})`;
}

async function readPDF(args: any): Promise<string> {
  const { filename } = args;
  return await getPDFInfo({ filename });
}

async function extractText(args: any): Promise<string> {
  const { filename } = args;

  if (adobeAvailable) {
    return await extractTextAdobe(filename);
  }

  const info = await getPDFInfo({ filename });
  return `PDF Info:\n${info}\n\nNote: Advanced text extraction requires Adobe credentials. Use analyze_pdf for AI analysis.`;
}

async function extractTextAdobe(filename: string): Promise<string> {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const AdmZip = require('adm-zip');

  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(CONTAINER_NAME);
  const blob = containerClient.getBlockBlobClient(filename);

  const download = await blob.download();
  const buffer = await streamToBuffer(download.readableStreamBody!);

  const tempDir = os.tmpdir();
  const tempInput = path.join(tempDir, `input_${Date.now()}.pdf`);
  const tempOutput = path.join(tempDir, `output_${Date.now()}.zip`);

  fs.writeFileSync(tempInput, buffer);

  try {
    const pdfServices = getPDFServicesClient();

    const readStream = fs.createReadStream(tempInput);
    const inputAsset = await pdfServices.upload({
      readStream,
      mimeType: MimeType.PDF
    });

    const params = new ExtractPDFParams({
      elementsToExtract: [ExtractElementType.TEXT]
    });

    const job = new ExtractPDFJob({ inputAsset, params });
    const pollingURL = await pdfServices.submit({ job });
    const response = await pdfServices.getJobResult({
      pollingURL,
      resultType: ExtractPDFResult
    });

    const resultAsset = response.result.resource;
    const streamAsset = await pdfServices.getContent({ asset: resultAsset });

    const writeStream = fs.createWriteStream(tempOutput);
    streamAsset.readStream.pipe(writeStream);

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    const zip = new AdmZip(tempOutput);
    const jsonEntry = zip.getEntry('structuredData.json');
    if (!jsonEntry) throw new Error('structuredData.json not found');

    const jsonData = JSON.parse(jsonEntry.getData().toString('utf8'));

    let text = '';
    for (const element of jsonData.elements || []) {
      if (element.Text) text += element.Text + '\n';
    }

    fs.unlinkSync(tempInput);
    fs.unlinkSync(tempOutput);

    return `Extracted text from ${filename} (Adobe AI):\n\n${text.trim()}`;

  } catch (error: any) {
    if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
    if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
    throw new Error(`Adobe extraction failed: ${error.message}`);
  }
}

async function analyzePDF(args: any): Promise<string> {
  const { filename, prompt } = args;

  const pdfInfo = await getPDFInfo({ filename });

  let extractedText = '';
  if (adobeAvailable) {
    try {
      extractedText = await extractTextAdobe(filename);
    } catch (error) {
      console.warn('Adobe extraction failed');
    }
  }

  const config = await getPowerNodeConfig();
  const model = config?.model || 'claude-3-5-sonnet-20241022';
  const apiKey = config?.apiKey || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) throw new Error('Anthropic API key not configured');

  const anthropic = new Anthropic({ apiKey });

  const systemPrompt = `Analyze this PDF:

${pdfInfo}

${extractedText ? `Text:\n${extractedText}` : 'Note: Full text not available'}

Request: ${prompt}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: 'user', content: systemPrompt }]
  });

  const text = response.content
    .filter((block: any) => block.type === 'text')
    .map((block: any) => block.text)
    .join('\n\n');

  return `AI Analysis of ${filename}:\n\n${text}`;
}

// Main handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { method, params, id } = req.body;

  try {
    switch (method) {
      case 'initialize':
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: {
              name: 'pdf-mcp-server',
              version: '1.0.0',
              features: {
                pdfLibEnabled: true,
                adobeEnabled: adobeAvailable,
                aiAnalysisAvailable: true
              }
            }
          }
        });

      case 'tools/list':
        return res.json({
          jsonrpc: '2.0',
          id,
          result: { tools: TOOLS }
        });

      case 'tools/call':
        const { name, arguments: args } = params;
        let result: string;

        switch (name) {
          case 'create_pdf': result = await createPDF(args); break;
          case 'get_pdf_info': result = await getPDFInfo(args); break;
          case 'list_pdfs': result = await listPDFs(args); break;
          case 'delete_pdf': result = await deletePDF(args); break;
          case 'get_pdf_url': result = await getPDFUrl(args); break;
          case 'copy_pdf': result = await copyPDF(args); break;
          case 'merge_pdfs': result = await mergePDFs(args); break;
          case 'split_pdf': result = await splitPDF(args); break;
          case 'add_text': result = await addText(args); break;
          case 'read_pdf': result = await readPDF(args); break;
          case 'extract_text': result = await extractText(args); break;
          case 'analyze_pdf': result = await analyzePDF(args); break;
          default: throw new Error(`Unknown tool: ${name}`);
        }

        return res.json({
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: result }] }
        });

      default:
        return res.status(400).json({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: 'Method not found' }
        });
    }
  } catch (error: any) {
    console.error('PDF MCP Error:', error);
    return res.json({
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: 'Internal error', data: error.message }
    });
  }
}
