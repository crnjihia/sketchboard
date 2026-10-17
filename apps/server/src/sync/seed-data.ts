import { BoardDocManager, CanvasObject } from '@sketchboard/shared';

/**
 * Seeds realistic Kenyan design and product team canvas artifacts
 * for initial demo sessions.
 */
export function seedNairobiHQ(docManager: BoardDocManager): void {
  const now = Date.now();

  const demoObjects: CanvasObject[] = [
    // 1. Surrounding Architecture Container (Rectangle)
    {
      id: 'container-nairobi-arch',
      type: 'rectangle',
      x: 100,
      y: 80,
      w: 860,
      h: 520,
      rotation: 0,
      z: 0,
      style: {
        fill: '#0F172A',
        stroke: '#334155',
        strokeWidth: 2,
        opacity: 0.95,
      },
      cornerRadius: 12,
      createdBy: 'system_seeder',
      updatedAt: now,
    },
    // 2. Frame Title
    {
      id: 'text-nairobi-title',
      type: 'text',
      x: 130,
      y: 110,
      w: 650,
      h: 40,
      rotation: 0,
      z: 1,
      style: {
        fill: '#F8FAFC',
        stroke: '#F8FAFC',
        strokeWidth: 1,
        opacity: 1,
      },
      text: '🇰🇪 Nairobi FinTech Super-App Architecture & Core Squad Sync',
      fontSize: 22,
      fontFamily: 'Inter, sans-serif',
      align: 'left',
      createdBy: 'system_seeder',
      updatedAt: now,
    },
    // 3. M-PESA Gateway Rectangle
    {
      id: 'card-mpesa-gateway',
      type: 'rectangle',
      x: 140,
      y: 180,
      w: 230,
      h: 110,
      rotation: 0,
      z: 2,
      style: {
        fill: '#1E293B',
        stroke: '#3B82F6', // Buluu
        strokeWidth: 2,
        opacity: 1,
      },
      cornerRadius: 8,
      createdBy: 'system_seeder',
      updatedAt: now,
    },
    // 3b. M-PESA Gateway Text
    {
      id: 'text-mpesa-label',
      type: 'text',
      x: 155,
      y: 215,
      w: 200,
      h: 50,
      rotation: 0,
      z: 3,
      style: {
        fill: '#93C5FD',
        stroke: '#93C5FD',
        strokeWidth: 1,
        opacity: 1,
      },
      text: 'Daraja M-PESA Gateway\n(C2B / B2C Webhooks)',
      fontSize: 14,
      fontFamily: 'Inter, sans-serif',
      align: 'center',
      createdBy: 'system_seeder',
      updatedAt: now,
    },
    // 4. KRA eTIMS Rectangle
    {
      id: 'card-etims-service',
      type: 'rectangle',
      x: 410,
      y: 180,
      w: 230,
      h: 110,
      rotation: 0,
      z: 4,
      style: {
        fill: '#1E293B',
        stroke: '#10B981', // Kijani
        strokeWidth: 2,
        opacity: 1,
      },
      cornerRadius: 8,
      createdBy: 'system_seeder',
      updatedAt: now,
    },
    // 4b. eTIMS Text
    {
      id: 'text-etims-label',
      type: 'text',
      x: 425,
      y: 215,
      w: 200,
      h: 50,
      rotation: 0,
      z: 5,
      style: {
        fill: '#6EE7B7',
        stroke: '#6EE7B7',
        strokeWidth: 1,
        opacity: 1,
      },
      text: 'KRA eTIMS Service\n(Fiscalization Engine)',
      fontSize: 14,
      fontFamily: 'Inter, sans-serif',
      align: 'center',
      createdBy: 'system_seeder',
      updatedAt: now,
    },
    // 5. National ID Ellipse Node
    {
      id: 'node-national-id',
      type: 'ellipse',
      x: 680,
      y: 180,
      w: 220,
      h: 110,
      rotation: 0,
      z: 6,
      style: {
        fill: '#1E293B',
        stroke: '#8B5CF6', // Zambarau
        strokeWidth: 2,
        opacity: 1,
      },
      createdBy: 'system_seeder',
      updatedAt: now,
    },
    // 5b. National ID Text
    {
      id: 'text-id-label',
      type: 'text',
      x: 695,
      y: 215,
      w: 190,
      h: 50,
      rotation: 0,
      z: 7,
      style: {
        fill: '#C084FC',
        stroke: '#C084FC',
        strokeWidth: 1,
        opacity: 1,
      },
      text: 'National IPRS / ID\nVerification Hub',
      fontSize: 14,
      fontFamily: 'Inter, sans-serif',
      align: 'center',
      createdBy: 'system_seeder',
      updatedAt: now,
    },
    // 6. Sticky Note 1: SLA Target (Njano)
    {
      id: 'sticky-c2b-sla',
      type: 'sticky',
      x: 140,
      y: 330,
      w: 230,
      h: 160,
      rotation: -1,
      z: 8,
      style: {
        fill: '#FEF3C7',
        stroke: '#F59E0B', // Njano
        strokeWidth: 1,
        opacity: 1,
      },
      text: '⚡ SLA Target:\nM-PESA STK Push callback latency must remain < 500ms across Safaricom fiber & 4G/5G hops.',
      authorName: 'Amina Kimani',
      color: 'Njano',
      fontSize: 13,
      createdBy: 'system_seeder',
      updatedAt: now,
    },
    // 7. Sticky Note 2: Offline First (Machungwa)
    {
      id: 'sticky-offline-sync',
      type: 'sticky',
      x: 410,
      y: 330,
      w: 230,
      h: 160,
      rotation: 1,
      z: 9,
      style: {
        fill: '#FFEDD5',
        stroke: '#F97316', // Machungwa
        strokeWidth: 1,
        opacity: 1,
      },
      text: '📱 Offline Cache:\nAgents wa mashinani need SQLite offline queue for transactions during rural network drops.',
      authorName: 'Juma Ochieng',
      color: 'Machungwa',
      fontSize: 13,
      createdBy: 'system_seeder',
      updatedAt: now,
    },
    // 8. Sticky Note 3: Westlands Merchants (Waridi)
    {
      id: 'sticky-westlands-ops',
      type: 'sticky',
      x: 680,
      y: 330,
      w: 220,
      h: 160,
      rotation: 0,
      z: 10,
      style: {
        fill: '#FCE7F3',
        stroke: '#EC4899', // Waridi
        strokeWidth: 1,
        opacity: 1,
      },
      text: '☕ Field Research:\nSquad sync with Westlands & CBD retail partners today at 15:00 EAT.',
      authorName: 'Zainab Wanjiru',
      color: 'Waridi',
      fontSize: 13,
      createdBy: 'system_seeder',
      updatedAt: now,
    },
    // 9. Arrow connector between Gateway and eTIMS
    {
      id: 'arrow-gateway-etims',
      type: 'arrow',
      x: 370,
      y: 235,
      w: 40,
      h: 1,
      rotation: 0,
      z: 11,
      style: {
        fill: 'transparent',
        stroke: '#F59E0B',
        strokeWidth: 3,
        opacity: 1,
      },
      createdBy: 'system_seeder',
      updatedAt: now,
    },
  ];

  docManager.transact(() => {
    for (const obj of demoObjects) {
      docManager.addObject(obj, 'seed:nairobi-hq');
    }
  }, 'seed');
}
