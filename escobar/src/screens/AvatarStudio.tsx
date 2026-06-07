import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Camera, UploadCloud, X, Loader2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import supabase from '../lib/supabase';

interface AvatarStudioProps {
  onBack?: () => void;
}

const MOOD_LABELS = {
  playful: 'Playful (Smirk)',
  affectionate: 'Affectionate (Smile)',
  excited: 'Excited (Glee)',
  annoyed: 'Annoyed (Pout)'
};

export default function AvatarStudio({ onBack }: AvatarStudioProps) {
  const { user, refreshProfile } = useAuth();
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Job status polling states
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<'idle' | 'processing' | 'succeeded' | 'failed'>('idle');
  const [jobProgress, setJobProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollingIntervalRef = useRef<any>(null);

  // Load active assets
  const fetchActiveAvatars = async () => {
    if (!user) return;
    try {
      const { data, error: fetchErr } = await supabase
        .from('avatar_assets')
        .select('mood_state, storage_url, replicate_job_id, created_at')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (fetchErr) throw fetchErr;

      const mapping: Record<string, string> = {};
      if (data && data.length > 0) {
        data.forEach((asset) => {
          mapping[asset.mood_state] = asset.storage_url;
        });
        setAvatarUrls(mapping);
      } else {
        setAvatarUrls({});
      }

      // Check if there are any active pending jobs in database to resume polling
      const { data: pendingData, error: pendingErr } = await supabase
        .from('avatar_assets')
        .select('replicate_job_id')
        .eq('user_id', user.id)
        .eq('storage_url', 'pending')
        .limit(1);

      if (pendingErr) throw pendingErr;
      if (pendingData && pendingData.length > 0) {
        const pendingJobId = pendingData[0].replicate_job_id;
        if (pendingJobId) {
          setActiveJobId(pendingJobId);
          setJobStatus('processing');
          setStatusMessage('Resuming generation check...');
        }
      }
    } catch (err) {
      console.error('Error loading avatar assets:', err);
    }
  };

  useEffect(() => {
    fetchActiveAvatars();
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [user]);

  // Polling hook when job is active
  useEffect(() => {
    if (!activeJobId || jobStatus !== 'processing') {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    const checkStatus = async () => {
      try {
        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes.data.session?.access_token;
        if (!token) return;

        const res = await fetch(`/api/avatar/status?job_id=${activeJobId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!res.ok) throw new Error('Failed to fetch job status');

        const { status, progress } = await res.json();
        
        setJobProgress(progress || 0);
        setStatusMessage(`Entrenando modelo de cara... (${progress || 0}%)`);

        if (status === 'succeeded') {
          setJobStatus('succeeded');
          setActiveJobId(null);
          setStatusMessage('Avatar generated successfully, maje! 🎉');
          await fetchActiveAvatars();
          await refreshProfile();
        } else if (status === 'failed') {
          setJobStatus('failed');
          setActiveJobId(null);
          setStatusMessage('Server error training the avatar.');
        }
      } catch (err) {
        console.error('Error polling status:', err);
      }
    };

    // Run first check immediately
    checkStatus();

    // Set interval to poll every 4 seconds
    pollingIntervalRef.current = setInterval(checkStatus, 4000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [activeJobId, jobStatus]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selected].slice(0, 10)); // cap 10 photos
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleGenerate = async () => {
    if (files.length < 5) {
      setError('Please select at least 5 photos.');
      return;
    }
    if (!user) return;

    setLoading(true);
    setError(null);
    setStatusMessage('Uploading reference photos...');

    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const randHash = Math.random().toString(36).substring(2, 10);
        const fileName = `studio_${i}_${randHash}.${fileExt}`;
        const filePath = `${user.id}/raw_photos/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from('avatar-images')
          .upload(filePath, file, { upsert: true });

        if (uploadErr) throw uploadErr;

        const { data: { publicUrl } } = supabase.storage
          .from('avatar-images')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
        setStatusMessage(`Uploading photos... (${i + 1}/${files.length})`);
      }

      setStatusMessage('Sending to Replicate GPU...');

      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      if (!token) throw new Error('No active session.');

      const response = await fetch('/api/avatar/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ photo_urls: uploadedUrls })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Error initiating generation.');
      }

      const { job_id } = await response.json();
      
      setActiveJobId(job_id);
      setJobStatus('processing');
      setFiles([]);
      setLoading(false);

    } catch (err: any) {
      console.error('Trigger regeneration error:', err);
      setError(err.message || 'Error processing request.');
      setStatusMessage(null);
      setLoading(false);
    }
  };

  const handleClearAvatars = async () => {
    if (!window.confirm('Are you sure you want to delete your custom avatar and revert to the illustrated one, maje?')) {
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // Set all active avatar assets to false
      const { error: clearError } = await supabase
        .from('avatar_assets')
        .update({ is_active: false })
        .eq('user_id', user?.id || '');

      if (clearError) throw clearError;

      // Reset profiles.avatar_ready = false
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ avatar_ready: false })
        .eq('id', user?.id || '');

      if (profileErr) throw profileErr;

      await refreshProfile();
      setAvatarUrls({});
      setStatusMessage('Custom avatar deleted.');
    } catch (err: any) {
      setError(err.message || 'Error deleting avatar.');
    } finally {
      setLoading(false);
    }
  };

  const moods: Array<'playful' | 'affectionate' | 'excited' | 'annoyed'> = ['playful', 'affectionate', 'excited', 'annoyed'];

  return (
    <div className="flex-1 flex flex-col bg-bg animate-fadeIn h-full justify-between">
      {/* Top Header */}
      <div className="flex items-center px-4 py-3 border-b border-primary/10 bg-white">
        <button 
          onClick={onBack}
          disabled={loading || jobStatus === 'processing'}
          className="flex items-center text-primary font-nunito font-bold text-sm gap-1 hover:opacity-80 active:scale-95 transition-all disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <h2 className="flex-1 text-center font-serif-display text-lg font-bold text-text pr-10">
          Avatar Studio
        </h2>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        
        {/* Status Messaging Banner */}
        {statusMessage && (
          <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
            jobStatus === 'failed' 
              ? 'bg-secondary/10 border-secondary/20 text-secondary' 
              : 'bg-[#FBEAF0] border-primary/20 text-primary'
          }`}>
            {jobStatus === 'processing' || loading ? (
              <Loader2 className="w-5 h-5 animate-spin shrink-0 text-primary mt-0.5" />
            ) : jobStatus === 'succeeded' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-primary mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-secondary mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-nunito text-xs font-bold uppercase tracking-wider">
                Process Status
              </p>
              <p className="font-nunito text-sm leading-relaxed">
                {statusMessage}
              </p>
              {jobStatus === 'processing' && (
                <div className="w-full h-1.5 bg-surface/50 rounded-full overflow-hidden mt-2 max-w-[200px]">
                  <div 
                    className="h-full bg-primary transition-all duration-500" 
                    style={{ width: `${jobProgress}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-secondary/15 border border-secondary/30 rounded-xl text-secondary text-xs font-nunito font-semibold text-center">
            {error}
          </div>
        )}

        {/* 2x2 Grid of Avatars */}
        <div className="space-y-3">
          <span className="font-nunito text-xs font-bold text-muted uppercase tracking-wider pl-1">
            Active Expressions
          </span>
          <div className="grid grid-cols-2 gap-4">
            {moods.map((mood) => {
              const url = avatarUrls[mood];
              return (
                <div 
                  key={mood}
                  className="bg-white border border-primary/10 rounded-2xl p-3 flex flex-col items-center shadow-sm relative group overflow-hidden"
                >
                  <div className="w-[80px] h-[80px] rounded-full bg-surface border-2 border-primary flex items-center justify-center overflow-hidden mb-2 relative z-10 shadow-sm">
                    {url && url !== 'pending' ? (
                      <img 
                        src={url} 
                        alt={mood} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <span className="font-serif-display text-3xl font-bold text-primary">E</span>
                    )}
                  </div>
                  <span className="font-nunito text-[11px] font-bold text-text uppercase tracking-wide">
                    {MOOD_LABELS[mood].split(' ')[0]}
                  </span>
                  <span className="font-nunito text-[9px] text-muted">
                    {MOOD_LABELS[mood].split(' ')[1] || ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Subir Nuevas Fotos Section */}
        {jobStatus !== 'processing' && !loading && (
          <div className="bg-white border border-primary/10 rounded-2xl p-4 shadow-sm space-y-4">
            <h3 className="font-serif-display text-lg font-bold text-primary flex items-center gap-1.5">
              <Camera className="w-5 h-5 text-primary" />
              <span>Regenerate Face</span>
            </h3>
            <p className="font-nunito text-xs text-muted leading-relaxed">
              Do you want to change Escobar's reference photos? Upload <span className="font-bold text-text">5-10 new photos</span> to retrain. The current avatar will be kept until generation is complete.
            </p>

            {/* Clickable Dash Area */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-24 border-2 border-dashed border-primary/20 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-all p-3"
            >
              <UploadCloud className="w-6 h-6 text-primary/70 mb-1" />
              <span className="font-nunito font-semibold text-[11px] text-text">
                Tap to select new photos
              </span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* File List Thumbnails */}
            {files.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-muted uppercase">
                  <span>Selected images</span>
                  <span>{files.length} / 10</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
                  {files.map((file, idx) => (
                    <div key={idx} className="relative w-12 h-12 rounded-lg overflow-hidden bg-white border border-primary/10 shrink-0">
                      <img 
                        src={URL.createObjectURL(file)} 
                        alt="thumb" 
                        className="w-full h-full object-cover" 
                      />
                      <button 
                        onClick={() => handleRemoveFile(idx)}
                        className="absolute top-0.5 right-0.5 bg-secondary text-white p-0.5 rounded-full hover:bg-secondary/90 transition-colors"
                      >
                        <X className="w-2 h-2" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={files.length < 5}
                  className="flex w-full items-center justify-center bg-primary text-white font-nunito font-bold text-xs h-10 rounded-[50px] shadow-sm hover:bg-primary/95 transition-all active:scale-[0.98] disabled:opacity-40"
                >
                  Train new Escobar
                </button>
              </div>
            )}
            
            {/* Clear custom avatar fallback */}
            {Object.keys(avatarUrls).length > 0 && (
              <button
                onClick={handleClearAvatars}
                className="flex w-full items-center justify-center border border-secondary text-secondary bg-transparent font-nunito font-bold text-xs h-10 rounded-[50px] hover:bg-secondary/5 transition-all active:scale-98"
              >
                Delete custom avatar
              </button>
            )}
          </div>
        )}

      </div>

      {/* Footer message */}
      <div className="px-5 py-4 border-t border-primary/5 bg-white text-center">
        <p className="font-nunito text-[10px] text-muted/60">
          Project Escobar Studio • V1.0
        </p>
      </div>
    </div>
  );
}
