import { NextResponse } from 'next/server';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST() {
  try {
    // Find all canvases that have sharedWith array but don't have collaborationEnabled
    const canvasesRef = collection(db, 'canvases');
    const canvasesSnap = await getDocs(canvasesRef);
    
    let updatedCount = 0;
    const updates: Promise<void>[] = [];
    
    canvasesSnap.forEach((canvasDoc) => {
      const data = canvasDoc.data();
      
      // If canvas has sharedWith users but collaborationEnabled is not true, update it
      if (data.sharedWith && data.sharedWith.length > 0 && !data.collaborationEnabled) {
        const canvasRef = doc(db, 'canvases', canvasDoc.id);
        updates.push(
          updateDoc(canvasRef, {
            collaborationEnabled: true
          })
        );
        updatedCount++;
      }
    });
    
    // Wait for all updates to complete
    await Promise.all(updates);
    
    return NextResponse.json({ 
      success: true, 
      message: `Updated ${updatedCount} canvases with collaboration enabled` 
    });
  } catch (error) {
    console.error('Error enabling collaboration:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to enable collaboration' },
      { status: 500 }
    );
  }
}