// path: apps/web/src/i18n/index.ts
export type Locale = 'en' | 'sw';

export interface Translations {
  toolbar: {
    select: string;
    hand: string;
    rectangle: string;
    ellipse: string;
    line: string;
    arrow: string;
    pen: string;
    text: string;
    sticky: string;
    grid: string;
    help: string;
    undo: string;
    redo: string;
    zoomIn: string;
    zoomOut: string;
    resetZoom: string;
  };
  header: {
    saved: string;
    saving: string;
    offline: string;
    participants: string;
    export: string;
    share: string;
    mpesa: string;
  };
  exportModal: {
    title: string;
    format: string;
    png: string;
    pdf: string;
    area: string;
    entireBoard: string;
    selectionOnly: string;
    options: string;
    transparentBackground: string;
    scale: string;
    cancel: string;
    download: string;
    preparing: string;
  };
  mpesaModal: {
    title: string;
    subtitle: string;
    badge: string;
    selectPlan: string;
    phoneLabel: string;
    phonePlaceholder: string;
    phoneHelp: string;
    payButton: string;
    initiatingButton: string;
    cbkLimitNote: string;
    promptTitle: string;
    promptInstruction: string;
    waitingForPin: string;
    simulateSuccess: string;
    simulateCancel: string;
    successTitle: string;
    successSubtitle: string;
    receiptLabel: string;
    amountPaidLabel: string;
    planLabel: string;
    phoneSentLabel: string;
    smsNotice: string;
    doneButton: string;
    failedTitle: string;
    failedReasonLabel: string;
    tryAgainButton: string;
    closeButton: string;
    invalidPhoneError: string;
  };
  help: {
    title: string;
    subtitle: string;
    shortcuts: {
      select: string;
      hand: string;
      rectangle: string;
      ellipse: string;
      line: string;
      arrow: string;
      pen: string;
      text: string;
      sticky: string;
      grid: string;
      delete: string;
      duplicate: string;
      selectAll: string;
      zOrder: string;
      nudge: string;
      undo: string;
      redo: string;
      help: string;
    };
  };
  toast: {
    copied: string;
    userJoined: string;
    userLeft: string;
    offlineWarning: string;
    reconnected: string;
  };
}

export const translations: Record<Locale, Translations> = {
  en: {
    toolbar: {
      select: 'Select (V)',
      hand: 'Hand / Pan (H)',
      rectangle: 'Rectangle (R)',
      ellipse: 'Ellipse (O)',
      line: 'Line (L)',
      arrow: 'Arrow (A)',
      pen: 'Freehand Pen (P)',
      text: 'Text (T)',
      sticky: 'Sticky Note (N)',
      grid: 'Toggle Grid (G)',
      help: 'Keyboard Shortcuts (?)',
      undo: 'Undo (Ctrl+Z)',
      redo: 'Redo (Ctrl+Shift+Z)',
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
      resetZoom: 'Reset Zoom (100%)',
    },
    header: {
      saved: 'Saved',
      saving: 'Saving…',
      offline: 'Offline (Pending)',
      participants: 'active squad members',
      export: 'Export',
      share: 'Share',
      mpesa: 'Lipa Na M-Pesa',
    },
    exportModal: {
      title: 'Export Board',
      format: 'Export Format',
      png: 'PNG (High-res Raster)',
      pdf: 'PDF (Vector Document)',
      area: 'Export Area',
      entireBoard: 'Entire Canvas Content',
      selectionOnly: 'Selected Shapes Only',
      options: 'Rendering Options',
      transparentBackground: 'Transparent Background (PNG)',
      scale: 'Resolution Scale',
      cancel: 'Cancel',
      download: 'Download Export',
      preparing: 'Rendering canvas…',
    },
    mpesaModal: {
      title: 'Upgrade Sketchboard Workspace',
      subtitle: 'Instant mobile checkout via Safaricom Lipa Na M-Pesa for Kenyan squads & creators',
      badge: 'LIPA NA M-PESA',
      selectPlan: 'Select Workspace Plan',
      phoneLabel: 'M-Pesa Mobile Number',
      phonePlaceholder: '0712 345 678 or 0110 123 456',
      phoneHelp: 'Enter your Safaricom or Airtel Money line registered for M-Pesa.',
      payButton: 'Pay with Lipa Na M-Pesa',
      initiatingButton: 'Initiating STK Push…',
      cbkLimitNote: 'Central Bank of Kenya STK limit: KES 300,000 per transaction.',
      promptTitle: 'Enter M-Pesa PIN on Handset',
      promptInstruction: 'An STK Push prompt has been sent to your mobile phone. Please check your handset and enter your 4-digit M-Pesa PIN to complete payment.',
      waitingForPin: 'Waiting for PIN authorization from Safaricom…',
      simulateSuccess: 'Simulate PIN Authorization (Dev)',
      simulateCancel: 'Simulate User Cancel (Dev)',
      successTitle: 'Malipo Yamefaulu! Payment Successful',
      successSubtitle: 'Your Sketchboard workspace plan has been upgraded and unlocked.',
      receiptLabel: 'M-Pesa Receipt Number',
      amountPaidLabel: 'Amount Paid',
      planLabel: 'Plan Tier',
      phoneSentLabel: 'Phone Number',
      smsNotice: "SMS confirmation dispatched via Africa's Talking gateway.",
      doneButton: 'Back to Canvas',
      failedTitle: 'Payment Cancelled or Failed',
      failedReasonLabel: 'Reason',
      tryAgainButton: 'Try Again',
      closeButton: 'Close',
      invalidPhoneError: 'Please enter a valid Kenyan mobile number (07... or 01...)',
    },
    help: {
      title: 'Keyboard Shortcuts',
      subtitle: 'Fast, Figma-like canvas hotkeys for Kenyan product squads',
      shortcuts: {
        select: 'Select / Move / Resize / Rotate',
        hand: 'Pan / Hand tool',
        rectangle: 'Rectangle shape',
        ellipse: 'Ellipse shape',
        line: 'Line connector',
        arrow: 'Directional arrow',
        pen: 'Freehand pen / sketch',
        text: 'Text annotation',
        sticky: 'Sticky note (with Swahili colors)',
        grid: 'Toggle background grid',
        delete: 'Delete selected shapes',
        duplicate: 'Duplicate selected shapes',
        selectAll: 'Select all shapes on board',
        zOrder: 'Send backward / Bring forward',
        nudge: 'Nudge 1px (Shift+Arrow for 10px)',
        undo: 'Undo local change',
        redo: 'Redo reverted change',
        help: 'Toggle this keyboard shortcuts dialog',
      },
    },
    toast: {
      copied: 'Board link copied to clipboard!',
      userJoined: 'joined the canvas',
      userLeft: 'left the canvas',
      offlineWarning: 'Connection interrupted. Edits are queued locally.',
      reconnected: 'Reconnected! Flushed offline edits.',
    },
  },
  sw: {
    toolbar: {
      select: 'Teua (V)',
      hand: 'Mkono / Sogea (H)',
      rectangle: 'Mstatili (R)',
      ellipse: 'Duara (O)',
      line: 'Mstari (L)',
      arrow: 'Mshale (A)',
      pen: 'Kalamu ya Mchoro (P)',
      text: 'Maandishi (T)',
      sticky: 'Karatasi ya Noti (N)',
      grid: 'Washa/Zima Gridi (G)',
      help: 'Njia za Mkato za Kibodi (?)',
      undo: 'Rejesha Nyuma (Ctrl+Z)',
      redo: 'Rudia Tena (Ctrl+Shift+Z)',
      zoomIn: 'Kuza Zaidi',
      zoomOut: 'Punguza Ukubwa',
      resetZoom: 'Weka Ukubwa Asili (100%)',
    },
    header: {
      saved: 'Imehifadhiwa',
      saving: 'Inahifadhi…',
      offline: 'Nje ya Mtandao (Inasubiri)',
      participants: 'wanachama waliopo ubaoni',
      export: 'Hamisha',
      share: 'Gawa Kiungo',
      mpesa: 'Lipa Na M-Pesa',
    },
    exportModal: {
      title: 'Hamisha Mchoro',
      format: 'Aina ya Faili',
      png: 'Picha ya PNG',
      pdf: 'Waraka wa PDF',
      area: 'Eneo la Kuhamisha',
      entireBoard: 'Michoro Yote Kwenye Ubao',
      selectionOnly: 'Vitu Vilivyoteuliwa Tu',
      options: 'Chaguzi za Mchoro',
      transparentBackground: 'Usuli Wazi Bila Rangi (PNG)',
      scale: 'Kipimo cha Ubora',
      cancel: 'Ghairi',
      download: 'Pakua Mchoro',
      preparing: 'Inatayarisha mchoro…',
    },
    mpesaModal: {
      title: 'Boresha Nafasi ya Sketchboard',
      subtitle: 'Malipo ya haraka kupitia Safaricom Lipa Na M-Pesa kwa ajili ya timu za Kenya',
      badge: 'LIPA NA M-PESA',
      selectPlan: 'Chagua Kifurushi cha Ubao',
      phoneLabel: 'Nambari ya Simu ya M-Pesa',
      phonePlaceholder: '0712 345 678 au 0110 123 456',
      phoneHelp: 'Weka nambari ya Safaricom au Airtel iliyosajiliwa na M-Pesa.',
      payButton: 'Lipa Kupitia M-Pesa',
      initiatingButton: 'Inatuma Ombi la STK…',
      cbkLimitNote: 'Kikomo cha Benki Kuu ya Kenya (CBK): KES 300,000 kwa kila muamala.',
      promptTitle: 'Weka Nambari ya Siri (PIN) Kwenye Simu',
      promptInstruction: 'Ujumbe wa STK Push umetumwa kwenye simu yako. Tafadhali fungua simu yako na uweke PIN yako ya M-Pesa kukamilisha malipo.',
      waitingForPin: 'Inasubiri uthibitisho wa PIN kutoka Safaricom…',
      simulateSuccess: 'Iga Uthibitisho wa PIN (Majaribio)',
      simulateCancel: 'Iga Kughairi kwa Mtumiaji (Majaribio)',
      successTitle: 'Malipo Yamefaulu! Hongera',
      successSubtitle: 'Kifurushi chako cha Sketchboard kimewashwa mara moja.',
      receiptLabel: 'Nambari ya Risiti ya M-Pesa',
      amountPaidLabel: 'Kiasi Kilicholipwa',
      planLabel: 'Aina ya Kifurushi',
      phoneSentLabel: 'Nambari ya Simu',
      smsNotice: "Ujumbe wa uthibitisho (SMS) umetumwa kupitia Africa's Talking.",
      doneButton: 'Rudi Ubaoni',
      failedTitle: 'Malipo Yameshindwa au Kughairiwa',
      failedReasonLabel: 'Sababu',
      tryAgainButton: 'Jaribu Tena',
      closeButton: 'Funga',
      invalidPhoneError: 'Tafadhali weka nambari sahihi ya simu ya Kenya (07... au 01...)',
    },
    help: {
      title: 'Njia za Mkato za Kibodi',
      subtitle: 'Njia za haraka kama za Figma kwa ajili ya timu za ubunifu Kenya',
      shortcuts: {
        select: 'Teua / Sogeza / Badili Ukubwa / Zungusha',
        hand: 'Zunguka kwenye ubao',
        rectangle: 'Umbo la mstatili',
        ellipse: 'Umbo la duara',
        line: 'Mstari wa kuunganisha',
        arrow: 'Mshale wa mwelekeo',
        pen: 'Kalamu ya kuchora kwa mkono',
        text: 'Sanduku la maandishi',
        sticky: 'Karatasi ya noti (Rangi za Kiswahili)',
        grid: 'Washa au zima gridi ya ubao',
        delete: 'Futa vitu vilivyoteuliwa',
        duplicate: 'Nakili vitu vilivyoteuliwa mara mbili',
        selectAll: 'Teua vitu vyote ubaoni',
        zOrder: 'Peleka nyuma / Leta mbele kwenye tabaka',
        nudge: 'Sogeza kidogo (Shift kwa hatua kubwa)',
        undo: 'Rejesha mabadiliko ya hivi karibuni',
        redo: 'Rudia mabadiliko yaliyofutwa',
        help: 'Fungua au funga dirisha hili la msaada',
      },
    },
    toast: {
      copied: 'Kiungo cha ubao kimenakiliwa!',
      userJoined: 'amejiunga na ubao',
      userLeft: 'ameondoka ubaoni',
      offlineWarning: 'Mtandao umekatika. Kazi inahifadhiwa kwenye kifaa chako.',
      reconnected: 'Umeunganishwa tena! Mabadiliko yote yamepakiwa.',
    },
  },
};
