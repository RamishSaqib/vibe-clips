import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './Settings.css';

export function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    // Load saved API key on mount
    loadApiKey();
  }, []);

  const loadApiKey = async () => {
    try {
      setIsLoading(true);
      const key = await invoke<string>('get_api_key');
      if (key) {
        setApiKey(key);
        setIsSaved(true);
      } else {
        setIsSaved(false);
      }
    } catch (error) {
      // No API key found - that's okay
      setIsSaved(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      alert('Please enter an API key');
      return;
    }

    try {
      await invoke('save_api_key', { apiKey: apiKey.trim() });
      setIsSaved(true);
      alert('API key saved securely!');
    } catch (error) {
      console.error('Failed to save API key:', error);
      alert(`Failed to save API key: ${error}`);
    }
  };

  const handleDelete = async () => {
    try {
      await invoke('delete_api_key');
      setApiKey('');
      setIsSaved(false);
      setShowDeleteConfirm(false);
      alert('API key deleted');
    } catch (error) {
      console.error('Failed to delete API key:', error);
      alert(`Failed to delete API key: ${error}`);
    }
  };

  return (
    <div className="settings">
      <h2>Settings</h2>
      
      <div className="setting-group">
        <label htmlFor="api-key">OpenAI API Key</label>
        <div className="api-key-input-group">
          <input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setIsSaved(false);
            }}
            placeholder="sk-..."
            disabled={isLoading}
            className={isSaved ? 'saved' : ''}
          />
          {isSaved && <span className="saved-indicator">✓ Saved</span>}
        </div>
        
        <div className="setting-actions">
          <button onClick={handleSave} disabled={isLoading || !apiKey.trim()}>
            Save API Key
          </button>
          {isSaved && (
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="delete-button"
            >
              Delete
            </button>
          )}
        </div>

        <p className="help-text">
          Get your API key from{' '}
          <a 
            href="https://platform.openai.com/api-keys" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            OpenAI Platform
          </a>
          <br />
          <span className="cost-note">
            Note: API costs approximately $0.006 per minute of audio transcribed
          </span>
        </p>
      </div>

      {showDeleteConfirm && (
        <div className="delete-confirm-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="delete-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>Are you sure you want to delete your API key?</p>
            <div className="confirm-actions">
              <button onClick={handleDelete} className="delete-button">Yes, Delete</button>
              <button onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

