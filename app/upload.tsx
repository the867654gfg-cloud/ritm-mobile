import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Platform, Modal } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

interface FileToUpload {
  fileObj?: File | any;
  name: string;
  size: number;
  duration?: number;
  coverBlob?: Blob | null;
}

// Функция для чтения ID3-тегов (обложки и длительности) прямо из MP3 в браузере
async function extractMetadata(file: File): Promise<{ duration: number; coverBlob: Blob | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement('audio');
    audio.src = url;
    audio.preload = 'metadata';

    audio.onloadedmetadata = async () => {
      const duration = audio.duration && !isNaN(audio.duration) ? audio.duration : 180;
      URL.revokeObjectURL(url);

      // Пробуем извлечь картинку через jsmediatags или чтение ArrayBuffer
      try {
        const reader = new FileReader();
        reader.onload = function (e) {
          try {
            const buffer = e.target?.result as ArrayBuffer;
            if (!buffer) {
              resolve({ duration, coverBlob: null });
              return;
            }
            // Простейший поиск тега APIC / Cover в ID3v2
            const view = new DataView(buffer);
            let offset = 0;
            // Проверка заголовка ID3
            if (view.getUint8(0) === 0x49 && view.getUint8(1) === 0x44 && view.getUint8(2) === 0x33) {
              // Проходим по байтам в поисках изображений (image/jpeg или image/png)
              const bytes = new Uint8Array(buffer);
              let foundIndex = -1;
              let mimeType = 'image/jpeg';

              for (let i = 0; i < bytes.length - 10; i++) {
                if (
                  (bytes[i] === 0xff && bytes[i + 1] === 0xd8) || // JPEG SOF
                  (bytes[i] === 0x89 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x4e && bytes[i + 3] === 0x47) // PNG
                ) {
                  // Проверяем, не слишком ли рано (ищем примерно в заголовке тегов)
                  if (i > 0 && i < 50000) {
                    foundIndex = i;
                    if (bytes[i] === 0x89) mimeType = 'image/png';
                    break;
                  }
                }
              }

              if (foundIndex !== -1) {
                // Вырезаем картинку до конца тегов или разумного размера
                const imageBytes = bytes.slice(foundIndex, foundIndex + 500000); 
                const coverBlob = new Blob([imageBytes], { type: mimeType });
                resolve({ duration, coverBlob });
                return;
              }
            }
            resolve({ duration, coverBlob: null });
          } catch (err) {
            resolve({ duration, coverBlob: null });
          }
        };
        reader.readAsArrayBuffer(file.slice(0, 200000)); // читаем первые 200Кб где обычно лежит обложка
      } catch (ex) {
        resolve({ duration, coverBlob: null });
      }
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ duration: 180, coverBlob: null });
    };
  });
}

export default function UploadScreen() {
  const [selectedFiles, setSelectedFiles] = useState<FileToUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [resultModal, setResultModal] = useState<{ visible: boolean; successCount: number; errors: string[] }>({
    visible: false,
    successCount: 0,
    errors: []
  });

  // Выбор нескольких файлов с предварительным чтением метаданных
  const handlePickFiles = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = 'audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg';
      
      input.onchange = async (e: any) => {
        const files: FileList = e.target.files;
        if (!files || files.length === 0) return;

        const newFiles: FileToUpload[] = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const meta = await extractMetadata(f);
          newFiles.push({
            fileObj: f,
            name: f.name,
            size: f.size,
            duration: meta.duration,
            coverBlob: meta.coverBlob
          });
        }
        setSelectedFiles(prev => [...prev, ...newFiles]);
      };
      input.click();
    }
  };

  // Процесс загрузки
  const handleStartUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: selectedFiles.length });

    let successCount = 0;
    const errors: string[] = [];
    const userId = 'public-user';

    for (let i = 0; i < selectedFiles.length; i++) {
      const item = selectedFiles[i];
      setUploadProgress({ current: i + 1, total: selectedFiles.length });

      try {
        if (!item.fileObj) {
          throw new Error('Файл не выбран');
        }

        const cleanFileName = item.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileExt = cleanFileName.split('.').pop() || 'mp3';
        const timestamp = Date.now();
        const storagePath = `${userId}/${timestamp}_${cleanFileName}`;

        // 1. Загрузка аудиофайла в Supabase Storage
        const { error: storageError } = await supabase.storage
          .from('music-storage')
          .upload(storagePath, item.fileObj, {
            contentType: item.fileObj.type || `audio/${fileExt}`,
            upsert: true
          });

        if (storageError) throw storageError;

        const { data: urlData } = supabase.storage
          .from('music-storage')
          .getPublicUrl(storagePath);
        const publicAudioUrl = urlData.publicUrl;

        // 2. Если у файла есть встроенная обложка, загружаем её тоже в Supabase Storage
        let publicCoverUrl = '';
        if (item.coverBlob) {
          const coverPath = `${userId}/${timestamp}_cover.jpg`;
          const { error: coverStorageError } = await supabase.storage
            .from('music-storage')
            .upload(coverPath, item.coverBlob, {
              contentType: 'image/jpeg',
              upsert: true
            });

          if (!coverStorageError) {
            const { data: coverUrlData } = supabase.storage
              .from('music-storage')
              .getPublicUrl(coverPath);
            publicCoverUrl = coverUrlData.publicUrl;
          }
        }

        // Извлекаем название трека из имени файла
        const nameWithoutExt = item.name.replace(/\.[^/.]+$/, '');
        const title = nameWithoutExt.trim();

        // 3. Запись метаданных трека в БД Supabase (включая обложку и реальную длительность)
        const { error: dbError } = await supabase
          .from('tracks')
          .insert({
            id: String(timestamp),
            title: title,
            audio_url: publicAudioUrl,
            cover_key: publicCoverUrl || null,
            duration: item.duration || 180,
            genre: 'Deep House'
          });

        if (dbError) throw dbError;

        successCount++;
      } catch (err: any) {
        errors.push(`${item.name}: ${err.message || 'Ошибка сети/доступа'}`);
      }
    }

    setIsUploading(false);
    setSelectedFiles([]);
    setResultModal({
      visible: true,
      successCount,
      errors
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0e0e11', padding: 24 }}>
      {/* Шапка */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <Pressable onPress={() => router.back()} style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}>
          <Text style={{ color: '#ffffff', fontWeight: '700' }}>← Назад</Text>
        </Pressable>
        <Text style={{ fontSize: 22, fontWeight: '900', color: '#ffffff' }}>Загрузить треки в облако</Text>
        <View style={{ width: 80 }} />
      </View>

      {/* Зона выбора файлов */}
      <Pressable 
        onPress={handlePickFiles}
        disabled={isUploading}
        style={{
          borderWidth: 2,
          borderColor: '#fa233b',
          borderStyle: 'dashed',
          borderRadius: 20,
          padding: 32,
          alignItems: 'center',
          backgroundColor: 'rgba(250, 35, 59, 0.05)',
          marginBottom: 24
        }}
      >
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🎵</Text>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#ffffff', marginBottom: 6 }}>Выберите аудиофайлы</Text>
        <Text style={{ fontSize: 13, color: '#8e8e93', textAlign: 'center' }}>Поддерживаются MP3 с обложками, WAV, FLAC, M4A</Text>
      </Pressable>

      {/* Список выбранных файлов */}
      {selectedFiles.length > 0 && (
        <View style={{ flex: 1, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#8e8e93', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
              Выбрано файлов: {selectedFiles.length}
            </Text>
            {!isUploading && (
              <Pressable onPress={() => setSelectedFiles([])}>
                <Text style={{ color: '#fa233b', fontSize: 13, fontWeight: '700' }}>Очистить</Text>
              </Pressable>
            )}
          </View>

          <ScrollView style={{ flex: 1 }}>
            {selectedFiles.map((file, idx) => (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', padding: 12, borderRadius: 12, marginBottom: 8 }}>
                <Text style={{ fontSize: 18, marginRight: 12 }}>{file.coverBlob ? '🖼️' : '🎶'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{file.name}</Text>
                  <Text style={{ color: '#8e8e93', fontSize: 11, marginTop: 2 }}>
                    {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.coverBlob ? 'Обложка найдена ✓' : 'Без обложки'}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Кнопка отправки */}
          <Pressable 
            onPress={handleStartUpload}
            disabled={isUploading}
            style={{
              backgroundColor: '#fa233b',
              paddingVertical: 16,
              borderRadius: 16,
              alignItems: 'center',
              marginTop: 12,
              opacity: isUploading ? 0.6 : 1
            }}
          >
            {isUploading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator color="#ffffff" size="small" />
                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 15 }}>
                  Загрузка {uploadProgress.current} из {uploadProgress.total}...
                </Text>
              </View>
            ) : (
              <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 16 }}>Начать загрузку</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* Модальное окно результата */}
      <Modal animationType="fade" transparent visible={resultModal.visible}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 420, backgroundColor: '#1c1c1e', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#ffffff', marginBottom: 12 }}>Результат загрузки</Text>
            <Text style={{ color: '#ffffff', fontSize: 15, marginBottom: 12 }}>
              Успешно загружено: <Text style={{ color: '#4cd964', fontWeight: '800' }}>{resultModal.successCount}</Text>
            </Text>

            {resultModal.errors.length > 0 && (
              <View style={{ backgroundColor: 'rgba(250, 35, 59, 0.15)', padding: 12, borderRadius: 12, marginBottom: 16 }}>
                <Text style={{ color: '#fa233b', fontWeight: '800', fontSize: 13, marginBottom: 6 }}>Ошибки:</Text>
                {resultModal.errors.map((err, i) => (
                  <Text key={i} style={{ color: '#ffffff', fontSize: 12, marginBottom: 4 }}>• {err}</Text>
                ))}
              </View>
            )}

            <Pressable 
              onPress={() => {
                setResultModal({ visible: false, successCount: 0, errors: [] });
                router.replace('/(tabs)');
              }}
              style={{ backgroundColor: '#fa233b', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#ffffff', fontWeight: '800' }}>Перейти к трекам</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}