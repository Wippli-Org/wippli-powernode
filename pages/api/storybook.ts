import type { NextApiRequest, NextApiResponse } from 'next';

interface PageData {
  page_number: number;
  image_url: string;
  text: string;
}

interface StorybookData {
  total_pages: number;
  child_name?: string;
  title?: string;
  subtitle?: string;
  pages: PageData[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Allow CORS for n8n webhook
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const data = req.body;

      // Transform n8n workflow output to structured page data
      const pages: PageData[] = [];

      for (let i = 1; i <= (data.total_pages || 8); i++) {
        const pageNum = `page_${i}`;
        if (data[`${pageNum}_image_url`]) {
          pages.push({
            page_number: i,
            image_url: data[`${pageNum}_image_url`],
            text: data[`${pageNum}_text`] || ''
          });
        }
      }

      const storybookData: StorybookData = {
        total_pages: data.total_pages || pages.length,
        child_name: data.child_name || 'Our Hero',
        title: data.title || `${data.child_name || 'Isabella'}'s Journey of Respect`,
        subtitle: data.subtitle || 'A Magical Story of Kindness',
        pages: pages.sort((a, b) => a.page_number - b.page_number)
      };

      // Return the storybook data with a URL to view it
      const viewUrl = `${req.headers.origin || 'http://localhost:3001'}/storybook?data=${encodeURIComponent(JSON.stringify(storybookData))}`;

      return res.status(200).json({
        success: true,
        message: 'Storybook data processed successfully',
        data: storybookData,
        viewUrl: viewUrl
      });

    } catch (error) {
      console.error('Error processing storybook data:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to process storybook data',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else if (req.method === 'GET') {
    // Return example structure
    return res.status(200).json({
      message: 'Storybook API endpoint',
      usage: {
        method: 'POST',
        body: {
          total_pages: 8,
          child_name: 'Isabella',
          title: 'Custom Title',
          subtitle: 'Custom Subtitle',
          page_1_image_url: 'https://example.com/image1.png',
          page_1_text: 'Page 1 text content',
          page_2_image_url: 'https://example.com/image2.png',
          page_2_text: 'Page 2 text content',
          // ... up to page_8
        }
      }
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
