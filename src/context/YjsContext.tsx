import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Shape } from '../models/Shape';

type YjsContextType = {
  ydoc: Y.Doc;
  shapesArray: Y.Array<Shape>;
  // optional helper to add shape
  addShape: (shape: Shape) => void;
  updateShape: (updated: Shape) => void;
};

const YjsContext = createContext<YjsContextType | null>(null);

export const YjsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ydocRef = useRef<Y.Doc>(new Y.Doc());
  const providerRef = useRef<WebsocketProvider | null>(null);
  const [shapesArray] = useState(() => ydocRef.current.getArray<Shape>('shapes'));

  useEffect(() => {
    // Connect to local websocket server (we'll run on port 1234)
    providerRef.current = new WebsocketProvider('ws://localhost:1234', 'sketchboard-room', ydocRef.current);
    return () => {
      providerRef.current?.destroy();
      ydocRef.current.destroy();
    };
  }, []);

  const addShape = (shape: Shape) => {
    shapesArray.push([shape]);
  };

  const updateShape = (updated: Shape) => {
    const index = shapesArray.toArray().findIndex(s => s.id === updated.id);
    if (index !== -1) {
      shapesArray.delete(index, 1);
      shapesArray.insert(index, [updated]);
    }
  };

  return (
    <YjsContext.Provider value={{ ydoc: ydocRef.current, shapesArray, addShape, updateShape }}>
      {children}
    </YjsContext.Provider>
  );
};

export const useYjs = () => {
  const ctx = useContext(YjsContext);
  if (!ctx) throw new Error('useYjs must be used within YjsProvider');
  return ctx;
};
