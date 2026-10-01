import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const DEFAULT_COVERS = [
  'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&q=80',
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&q=80',
];

// Извлекатель обложек MP3 (ID3v2.2, ID3v2.3, ID3v2.4)
async function extractMp3Cover(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!file || typeof FileReader === 'undefined') return resolve(null);
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        if (!buffer || buffer.byteLength < 10) return resolve(null);
        const view = new DataView(buffer);

        if (view.getUint8(0) !== 0x49 || view.getUint8(1) !== 0x44 || view.getUint8(2) !== 0x33) {
          return resolve(null);
        }

        const version = view.getUint8(3);
        const tagSize = ((view.getUint8(6) & 0x7f) << 21) |
                        ((view.getUint8(7) & 0x7f) << 14) |
                        ((view.getUint8(8) & 0x7f) << 7)  |
                         (view.getUint8(9) & 0x7f);

        let offset = 10;
        const maxOffset = Math.min(buffer.byteLength, tagSize + 10);

        while (offset < maxOffset - 10) {
          let frameId = '';
          let frameSize = 0;
          let headerSize = 10;

          if (version === 2) {
            frameId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset+1), view.getUint8(offset+2));
            frameSize = (view.getUint8(offset+3) << 16) | (view.getUint8(offset+4) << 8) | view.getUint8(offset+5);
            headerSize = 6;
          } else {
            frameId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset+1), view.getUint8(offset+2), view.getUint8(offset+3));
            if (version === 4) {
              frameSize = ((view.getUint8(offset+4) & 0x7f) << 21) |
                          ((view.getUint8(offset+5) & 0x7f) << 14) |
                          ((view.getUint8(offset+6) & 0x7f) << 7)  |
                           (view.getUint8(offset+7) & 0x7f);
            } else {
              frameSize = view.getUint32(offset + 4);
            }
            headerSize = 10;
          }

          if (!frameId || frameSize <= 0 || offset + headerSize + frameSize > maxOffset) break;

          if (frameId === 'APIC' || frameId === 'PIC') {
            const frameStart = offset + headerSize;
            const encoding = view.getUint8(frameStart);

            let mimeType = 'image/jpeg';
            let pos = frameStart + 1;

            if (version === 2) {
              const format = String.fromCharCode(view.getUint8(pos), view.getUint8(pos+1), view.getUint8(pos+2)).toLowerCase();
              mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
              pos += 4;
            } else {
              let mimeStart = pos;
              while (pos < frameStart + frameSize && view.getUint8(pos) !== 0) pos++;
              const mimeBytes = new Uint8Array(buffer, mimeStart, pos - mimeStart);
              const extractedMime = new TextDecoder().decode(mimeBytes);
              if (extractedMime && extractedMime.includes('/')) mimeType = extractedMime;
              pos += 2;
            }

            if (encoding === 0 || encoding === 3) {
              while (pos < frameStart + frameSize && view.getUint8(pos) !== 0) pos++;
              pos += 1;
            } else {
              while (pos < frameStart + frameSize - 1 && !(view.getUint8(pos) === 0 && view.getUint8(pos+1) === 0)) pos += 2;
              pos += 2;
            }

            if (pos < frameStart + frameSize) {
              const imgData = new Uint8Array(buffer, pos, (frameStart + frameSize) - pos);
              return resolve(new Blob([imgData], { type: mimeType.startsWith('image/') ? mimeType : 'image/jpeg' }));
            }
          }

          offset += headerSize + frameSize;
        }
        resolve(null);
      } catch (e) {
        resolve(null);
      }
    };
    reader.onerror = () => resolve(null);
    reader.readAsArrayBuffer(file.slice(0, Math.min(file.size, 4 * 1024 * 1024)));
  });
}

export default function UploadScreen() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [uploadedCount, setUploadedCount] = useState(0);

  const handlePickFiles = (e: any) => {
    if (Platform.OS === 'web' && e.target.files) {
      const selectedFiles = Array.from(e.target.files) as File[];
      setFiles(selectedFiles.slice(0, 64));
    }
  };

  const handleBatchUpload = async () => {
    if (files.length === 0) {
      alert('Пожалуйста, выберите MP3 файлы!');
      return;
    }

    setUploading(true);
    setUploadedCount(0);
    let successCount = 0;
    const errorLog: string[] = [];

    for (let i = 0; i < files.length; i++) {
      setCurrentIndex(i + 1);
      const currentFile = files[i];

      try {
        const fileExt = currentFile.name.split('.').pop() || 'mp3';
        const fileId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const fileName = `${fileId}.${fileExt}`;

        // 1. Извлечение встроенной обложки MP3
        let finalCoverUrl = '';
        try {
          const coverBlob = await extractMp3Cover(currentFile);
          if (coverBlob && coverBlob.size > 100) {
            const coverFileName = `covers/cover_${fileId}.jpg`;
            const { error: coverErr } = await supabase.storage
              .from('music-storage')
              .upload(coverFileName, coverBlob, {
                contentType: coverBlob.type || 'image/jpeg',
                upsert: true,
              });

            if (!coverErr) {
              const { data: cUrlData } = supabase.storage
                .from('music-storage')
                .getPublicUrl(coverFileName);
              if (cUrlData?.publicUrl) {
                finalCoverUrl = cUrlData.publicUrl;
              }
            }
          }
        } catch (e) {}

        // Если обложки в файле нет, выбираем красивую заглушку
        if (!finalCoverUrl) {
          finalCoverUrl = DEFAULT_COVERS[i % DEFAULT_COVERS.length];
        }

        // 2. Загрузка MP3 файла в Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('music-storage')
          .upload(fileName, currentFile, {
            cacheControl: '3600',
            upsert: true,
            contentType: currentFile.type || 'audio/mpeg',
          });

        if (uploadError) {
          errorLog.push(`${currentFile.name}: ${uploadError.message}`);
          continue;
        }

        const { data: urlData } = supabase.storage.from('music-storage').getPublicUrl(fileName);
        const publicAudioUrl = urlData?.publicUrl;

        if (!publicAudioUrl) {
          errorLog.push(`${currentFile.name}: не удалось получить URL`);
          continue;
        }

        const cleanTitle = currentFile.name.replace(/\.[^/.]+$/, '');
        const trackDbId = typeof crypto !== 'undefined' && crypto.randomUUID 
          ? crypto.randomUUID() 
          : `track_${fileId}`;

        // 3. Запись в таблицу tracks с полем cover_key
        const { error: dbError } = await supabase.from('tracks').insert([
          {
            id: trackDbId,
            title: cleanTitle,
            genre: 'Deep House',
            audio_url: publicAudioUrl,
            cover_key: finalCoverUrl,
            duration: 180,
          },
        ]);

        if (dbError) {
          errorLog.push(`${currentFile.name}: Ошибка БД: ${dbError.message}`);
        } else {
          successCount++;
          setUploadedCount(successCount);
        }
      } catch (err: any) {
        errorLog.push(`${currentFile.name}: ${err?.message || 'Сбой'}`);
      }
    }

    setUploading(false);

    if (errorLog.length > 0) {
      alert(`Загружено ${successCount} из ${files.length}.\n\nПричины:\n` + errorLog.join('\n'));
    } else {
      alert(`🎉 Успешно загружено треков: ${successCount} из ${files.length}`);
    }

    if (successCount > 0) {
      router.back();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#141416', padding: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
        <Pressable onPress={() => router.back()} style={{ padding: 8, marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </Pressable>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#ffffff' }}>Загрузить треки в облако</Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: '#1c1c1e', padding: 24, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(250, 35, 59, 0.3)', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(250, 35, 59, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
            <Ionicons name="cloud-upload" size={32} color="#fa233b" />
          </View>
          
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#ffffff', marginBottom: 6 }}>Выберите MP3 файлы</Text>
          <Text style={{ fontSize: 13, color: '#8e8e93', marginBottom: 20, textAlign: 'center' }}>
            Обложки треков извлекутся автоматически (до 64 файлов)
          </Text>

          {Platform.OS === 'web' && (
            <label style={{
              backgroundColor: '#fa233b',
              color: '#ffffff',
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 12,
              fontWeight: '700',
              fontSize: 14,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Ionicons name="folder-open-outline" size={18} color="#ffffff" />
              Обзор файлов...
              <input type="file" accept="audio/*" multiple onChange={handlePickFiles} style={{ display: 'none' }} />
            </label>
          )}
        </View>

        {files.length > 0 && (
          <View style={{ backgroundColor: '#1c1c1e', padding: 20, borderRadius: 16, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#8e8e93', textTransform: 'uppercase' }}>
                Выбрано файлов: {files.length} (макс. 64)
              </Text>
              <Pressable onPress={() => setFiles([])}>
                <Text style={{ fontSize: 12, color: '#fa233b', fontWeight: '600' }}>Очистить</Text>
              </Pressable>
            </View>

            {files.map((file, idx) => (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#2c2c2e', padding: 10, borderRadius: 8, marginBottom: 6 }}>
                <Ionicons name="musical-note" size={18} color="#fa233b" style={{ marginRight: 10 }} />
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: '#ffffff', fontWeight: '500' }}>{file.name}</Text>
                <Text style={{ fontSize: 11, color: '#8e8e93', marginLeft: 8 }}>{(file.size / (1024 * 1024)).toFixed(1)} MB</Text>
              </View>
            ))}
          </View>
        )}

        {files.length > 0 && (
          <Pressable
            onPress={handleBatchUpload}
            disabled={uploading}
            style={{
              backgroundColor: uploading ? '#444444' : '#fa233b',
              paddingVertical: 16,
              borderRadius: 14,
              alignItems: 'center',
              marginBottom: 40,
            }}
          >
            {uploading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator color="#ffffff" />
                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 15 }}>
                  Загрузка {currentIndex} из {files.length}... ({uploadedCount} готово)
                </Text>
              </View>
            ) : (
              <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 16 }}>
                Загрузить все {files.length} треков с обложками
              </Text>
            )}
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}