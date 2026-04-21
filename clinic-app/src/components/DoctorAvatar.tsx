'use client';

import React, { useRef, useState, useCallback } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { updateDoctorProfileImage } from '@/lib/actions';
import { Stethoscope, Camera, CheckCircle, AlertCircle } from 'lucide-react';
import { auth } from '@/lib/firebase';

interface DoctorAvatarProps {
  clinicId: string;
  imageUrl?: string | null;
  doctorName: string;
  editable?: boolean;
  size?: number;
  onUploadComplete?: (url: string) => void;
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

// Compress and resize image on canvas before upload (max 400x400, JPEG)
function compressImage(file: File, maxSize = 400): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      const ratio = Math.min(maxSize / width, maxSize / height, 1);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else reject(new Error('Canvas compression failed'));
        },
        'image/jpeg',
        0.85
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function DoctorAvatar({
  clinicId,
  imageUrl,
  doctorName,
  editable = false,
  size = 120,
  onUploadComplete,
}: DoctorAvatarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const activeImageUrl = previewUrl || imageUrl;
  const strokeCircumference = 2 * Math.PI * (size / 2 - 4);
  const strokeDashoffset = strokeCircumference - (progress / 100) * strokeCircumference;

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Create instant preview
      const localUrl = URL.createObjectURL(file);
      setPreviewUrl(localUrl);
      setUploadState('uploading');
      setProgress(0);

      try {
        const compressed = await compressImage(file);
        const storagePath = `doctors/${clinicId}/profile.jpg`;
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, compressed, {
          contentType: 'image/jpeg',
        });

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const pct = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            );
            setProgress(pct);
          },
          () => {
            setUploadState('error');
          },
          async () => {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            const phone = auth.currentUser?.phoneNumber || 'Staff';
            await updateDoctorProfileImage(clinicId, downloadUrl, phone);
            setUploadState('success');
            onUploadComplete?.(downloadUrl);
            // Reset success indicator after 3 seconds
            setTimeout(() => setUploadState('idle'), 3000);
          }
        );
      } catch {
        setUploadState('error');
        setTimeout(() => setUploadState('idle'), 3000);
      }

      // Reset input so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [clinicId, onUploadComplete]
  );

  const ringColor =
    uploadState === 'uploading'
      ? '#007BFF'
      : uploadState === 'success'
      ? '#28A745'
      : uploadState === 'error'
      ? '#DC3545'
      : '#007BFF';

  const initials = doctorName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
        cursor: editable ? 'pointer' : 'default',
      }}
      onMouseEnter={() => editable && setIsHovered(true)}
      onMouseLeave={() => editable && setIsHovered(false)}
      onClick={() => editable && fileInputRef.current?.click()}
      title={editable ? 'Click to change doctor photo' : doctorName}
    >
      {/* SVG progress ring */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}
      >
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 4}
          fill="none"
          stroke={uploadState !== 'idle' ? `${ringColor}22` : 'rgba(0,123,255,0.15)'}
          strokeWidth={4}
        />
        {/* Active progress / always-on accent ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 4}
          fill="none"
          stroke={ringColor}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={strokeCircumference}
          strokeDashoffset={
            uploadState === 'uploading'
              ? strokeDashoffset
              : uploadState === 'success' || uploadState === 'error'
              ? 0
              : strokeCircumference * 0.12 // small always-visible accent arc
          }
          style={{
            transition: uploadState === 'uploading' ? 'stroke-dashoffset 0.3s ease' : 'none',
            animation: uploadState === 'uploading' ? 'none' : undefined,
          }}
        />
      </svg>

      {/* Avatar circle */}
      <div
        style={{
          position: 'absolute',
          top: 6,
          left: 6,
          width: size - 12,
          height: size - 12,
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #e8f4fd, #cce4f8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid white',
          boxShadow: '0 4px 16px rgba(0,123,255,0.15)',
          transition: 'opacity 0.2s',
          opacity: isHovered ? 0.85 : 1,
        }}
      >
        {activeImageUrl ? (
          <img
            src={activeImageUrl}
            alt={doctorName}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ textAlign: 'center', color: '#007BFF' }}>
            {initials ? (
              <span
                style={{
                  fontSize: size * 0.28,
                  fontWeight: 700,
                  fontFamily: 'Outfit, sans-serif',
                  lineHeight: 1,
                  color: '#007BFF',
                }}
              >
                {initials}
              </span>
            ) : (
              <Stethoscope size={size * 0.4} color="#007BFF" />
            )}
          </div>
        )}
      </div>

      {/* Camera badge / status overlay */}
      {editable && (
        <div
          style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            width: 30,
            height: 30,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            background:
              uploadState === 'success'
                ? '#28A745'
                : uploadState === 'error'
                ? '#DC3545'
                : '#007BFF',
            transition: 'background 0.3s',
            zIndex: 2,
          }}
        >
          {uploadState === 'success' ? (
            <CheckCircle size={16} color="white" />
          ) : uploadState === 'error' ? (
            <AlertCircle size={16} color="white" />
          ) : (
            <Camera size={14} color="white" />
          )}
        </div>
      )}

      {/* Hidden file input */}
      {editable && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      )}
    </div>
  );
}
