/* BlankRoom — video-chat.js */
// Omegle-style video chat implementation

class OmegleVideoChat {
  constructor(socket) {
    this.socket = socket;
    this.peer = null;
    this.localStream = null;
    this.remoteStream = null;
    this.inVideoChat = false;
    this.isInitiator = false;
    this.audioEnabled = true;
    this.videoEnabled = true;
    this.partnerId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.permissionsGranted = false;
    this.searchInProgress = false;
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // STUN servers for NAT traversal
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.1und1.de:3478' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ];
    
    this.init();
  }

  init() {
    // Set up socket listeners for video
    this.socket.on('video_permission_requested', () => this.handlePermissionRequest());
    this.socket.on('video_searching', (data) => this.handleSearching(data));
    this.socket.on('video_paired', (data) => this.handlePaired(data));
    this.socket.on('video_offer', (data) => this.handleOffer(data));
    this.socket.on('video_answer', (data) => this.handleAnswer(data));
    this.socket.on('video_ice_candidate', (data) => this.handleIceCandidate(data));
    this.socket.on('video_stranger_left', (data) => this.handleStrangerLeft(data));
    this.socket.on('video_stranger_skipped', (data) => this.handleStrangerSkipped(data));
    this.socket.on('video_ended', (data) => this.handleVideoEnded(data));
    this.socket.on('video_reported', (data) => this.handleReported(data));
    this.socket.on('video_partner_toggle_audio', (data) => this.handlePartnerToggleAudio(data));
    this.socket.on('video_partner_toggle_video', (data) => this.handlePartnerToggleVideo(data));
    this.socket.on('video_report_submitted', (data) => this.handleReportSubmitted(data));
  }

  async requestPermissions(videoEnabled = true, audioEnabled = true) {
    // If permissions already granted and stream exists, just start searching
    if (this.permissionsGranted && this.localStream && this.localStream.active) {
      this.startSearch();
      return true;
    }
    
    try {
      // Mobile-friendly constraints
      const constraints = {
        video: videoEnabled ? {
          width: { ideal: this.isMobile ? 640 : 1280 },
          height: { ideal: this.isMobile ? 480 : 720 },
          facingMode: 'user',
          frameRate: { ideal: this.isMobile ? 24 : 30 }
        } : false,
        audio: audioEnabled ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false
      };
      
      // Show loading state
      this.updateVideoStatus('Requesting camera access...', 'searching');
      
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.permissionsGranted = true;
      
      // Display local video with proper orientation
      const localVideo = document.getElementById('local-video');
      if (localVideo) {
        localVideo.srcObject = this.localStream;
        localVideo.muted = true; // Mute local video to prevent echo
        localVideo.setAttribute('playsinline', true);
        localVideo.setAttribute('autoplay', true);
        
        // Apply mirror effect for natural self-view (but not for rear camera)
        // Check if it's front camera (facingMode: 'user')
        localVideo.style.transform = 'scaleX(-1)';
        
        // Handle video loaded
        localVideo.onloadedmetadata = () => {
          localVideo.play().catch(e => console.log('Autoplay prevented:', e));
        };
      }
      
      // Hide permission modal
      this.hideVideoModal();
      
      // Show video controls
      this.showVideoControls();
      
      // Start searching
      this.startSearch();
      
      return true;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      this.handlePermissionError(err);
      return false;
    }
  }

  startSearch() {
    if (this.searchInProgress) return;
    
    this.searchInProgress = true;
    this.updateVideoStatus('Searching for video partner...', 'searching');
    this.showVideoModal('Looking for someone to chat with...', 'searching');
    this.socket.emit('find_video_stranger');
    
    // Auto-hide modal after 3 seconds if still searching
    setTimeout(() => {
      if (this.searchInProgress && !this.inVideoChat) {
        this.hideVideoModal();
      }
    }, 3000);
  }

  handlePermissionRequest() {
    // Only show modal if permissions not already granted
    if (!this.permissionsGranted) {
      this.showVideoModal('Please allow camera and microphone access', 'info');
    } else {
      this.startSearch();
    }
  }

  handleSearching(data) {
    this.searchInProgress = true;
    this.updateVideoStatus(data.message, 'searching');
    
    // Only show modal if not already in video chat
    if (!this.inVideoChat) {
      this.showVideoModal(data.message, 'searching');
      
      // Auto-hide modal after 3 seconds
      setTimeout(() => {
        if (this.searchInProgress && !this.inVideoChat) {
          this.hideVideoModal();
        }
      }, 3000);
    }
  }

  handlePaired(data) {
    this.searchInProgress = false;
    this.inVideoChat = true;
    this.isInitiator = data.initiator;
    this.partnerId = data.from;
    
    // Hide modal
    this.hideVideoModal();
    this.hideReconnectModal();
    
    // Update UI
    this.updateVideoStatus('Connected!', 'connected');
    document.getElementById('video-controls').style.display = 'flex';
    
    const remotePlaceholder = document.getElementById('remote-placeholder');
    if (remotePlaceholder) {
      remotePlaceholder.style.display = 'none';
    }
    
    const remoteLoading = document.getElementById('remote-loading');
    if (remoteLoading) {
      remoteLoading.style.display = 'flex';
    }
    
    // Create peer connection
    this.createPeer(this.isInitiator);
    
    // Show notification (vibrate on mobile if supported)
    this.showNotification('Video partner connected!', 'success');
    if (this.isMobile && navigator.vibrate) {
      navigator.vibrate(200);
    }
  }

  createPeer(isInitiator) {
    // Clean up existing peer
    if (this.peer) {
      this.peer.destroy();
    }
    
    const Peer = window.SimplePeer;
    
    // Mobile-optimized peer configuration
    const peerConfig = {
      initiator: isInitiator,
      stream: this.localStream,
      trickle: true,
      config: {
        iceServers: this.iceServers
      },
      sdpTransform: (sdp) => {
        // Force VP8 for better mobile compatibility
        let modifiedSdp = sdp.replace(/VP9|H265/g, 'VP8');
        // Reduce bandwidth for mobile
        if (this.isMobile) {
          modifiedSdp = modifiedSdp.replace(/a=fmtp:\d+ (.*)/g, (match, params) => {
            return `a=fmtp:${params};x-google-max-bitrate=512;x-google-min-bitrate=128`;
          });
        }
        return modifiedSdp;
      }
    };

    this.peer = new Peer(peerConfig);

    this.peer.on('signal', (data) => {
      // Send signaling data to partner
      if (data.type === 'offer') {
        this.socket.emit('video_offer', { offer: data });
      } else if (data.type === 'answer') {
        this.socket.emit('video_answer', { answer: data });
      } else if (data.candidate) {
        this.socket.emit('video_ice_candidate', { candidate: data });
      }
    });

    this.peer.on('stream', (stream) => {
      // Remote stream received
      this.remoteStream = stream;
      const remoteVideo = document.getElementById('remote-video');
      if (remoteVideo) {
        remoteVideo.srcObject = stream;
        remoteVideo.style.display = 'block';
        remoteVideo.setAttribute('playsinline', true);
        remoteVideo.setAttribute('autoplay', true);
        
        // Don't mirror remote video
        remoteVideo.style.transform = 'scaleX(1)';
        
        remoteVideo.onloadedmetadata = () => {
          remoteVideo.play().catch(e => console.log('Remote video autoplay prevented:', e));
        };
      }
      
      // Hide loading indicator
      const remoteLoading = document.getElementById('remote-loading');
      if (remoteLoading) {
        remoteLoading.style.display = 'none';
      }
      
      const remotePlaceholder = document.getElementById('remote-placeholder');
      if (remotePlaceholder) {
        remotePlaceholder.style.display = 'none';
      }
      
      this.showNotification('Partner video connected!', 'success');
    });

    this.peer.on('connect', () => {
      console.log('Peer connection established');
      this.reconnectAttempts = 0;
    });

    this.peer.on('error', (err) => {
      console.error('Peer error:', err);
      this.handlePeerError(err);
    });

    this.peer.on('close', () => {
      console.log('Peer connection closed');
      if (this.inVideoChat) {
        this.handleStrangerLeft({ message: 'Connection lost' });
      }
    });
  }

  handleOffer(data) {
    if (this.peer) {
      this.peer.signal(data.offer);
    }
  }

  handleAnswer(data) {
    if (this.peer) {
      this.peer.signal(data.answer);
    }
  }

  handleIceCandidate(data) {
    if (this.peer) {
      this.peer.signal(data.candidate);
    }
  }

  handleStrangerLeft(data) {
    this.inVideoChat = false;
    this.partnerId = null;
    this.searchInProgress = false;
    
    this.showNotification('Stranger disconnected', 'error');
    this.updateVideoStatus('Stranger left', 'disconnected');
    
    // Clear remote video
    const remoteVideo = document.getElementById('remote-video');
    if (remoteVideo) {
      remoteVideo.srcObject = null;
      remoteVideo.style.display = 'none';
    }
    
    const remotePlaceholder = document.getElementById('remote-placeholder');
    if (remotePlaceholder) {
      remotePlaceholder.style.display = 'flex';
      remotePlaceholder.innerHTML = '⏳ Partner disconnected';
    }
    
    const remoteLoading = document.getElementById('remote-loading');
    if (remoteLoading) {
      remoteLoading.style.display = 'none';
    }
    
    document.getElementById('video-controls').style.display = 'none';
    
    // Clean up peer
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    
    // Show reconnect option (but don't ask for permissions again)
    this.showReconnectModal(data.message);
  }

  handleStrangerSkipped(data) {
    this.inVideoChat = false;
    this.partnerId = null;
    this.searchInProgress = false;
    
    this.showNotification('Stranger skipped', 'info');
    this.updateVideoStatus('Stranger skipped', 'disconnected');
    
    // Clear remote video
    const remoteVideo = document.getElementById('remote-video');
    if (remoteVideo) {
      remoteVideo.srcObject = null;
      remoteVideo.style.display = 'none';
    }
    
    const remotePlaceholder = document.getElementById('remote-placeholder');
    if (remotePlaceholder) {
      remotePlaceholder.style.display = 'flex';
      remotePlaceholder.innerHTML = '⏳ Looking for next partner...';
    }
    
    const remoteLoading = document.getElementById('remote-loading');
    if (remoteLoading) {
      remoteLoading.style.display = 'none';
    }
    
    document.getElementById('video-controls').style.display = 'none';
    
    // Clean up peer
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    
    // Auto search for new partner after 2 seconds (without asking permissions again)
    setTimeout(() => {
      if (!this.inVideoChat && this.permissionsGranted) {
        this.startSearch();
      }
    }, 2000);
  }

  handleVideoEnded(data) {
    this.inVideoChat = false;
    this.partnerId = null;
    this.searchInProgress = false;
    
    this.showNotification(data.message, 'info');
    this.updateVideoStatus('Ready to start', 'disconnected');
    this.cleanupVideoChat(false);
    
    document.getElementById('video-controls').style.display = 'none';
    
    const remotePlaceholder = document.getElementById('remote-placeholder');
    if (remotePlaceholder) {
      remotePlaceholder.style.display = 'flex';
      remotePlaceholder.innerHTML = '⏳ Ready to start new chat';
    }
  }

  handleReported(data) {
    this.inVideoChat = false;
    this.partnerId = null;
    this.searchInProgress = false;
    
    this.showNotification(data.message, 'warning');
    this.cleanupVideoChat(false);
    document.getElementById('video-controls').style.display = 'none';
    
    const remotePlaceholder = document.getElementById('remote-placeholder');
    if (remotePlaceholder) {
      remotePlaceholder.style.display = 'flex';
      remotePlaceholder.innerHTML = '⏳ Ready to start new chat';
    }
  }

  handlePartnerToggleAudio(data) {
    const indicator = document.getElementById('partner-audio-indicator');
    if (indicator) {
      if (data.enabled) {
        indicator.innerHTML = '🔊';
        indicator.classList.remove('muted');
        indicator.title = 'Partner audio on';
      } else {
        indicator.innerHTML = '🔇';
        indicator.classList.add('muted');
        indicator.title = 'Partner audio off';
      }
    }
  }

  handlePartnerToggleVideo(data) {
    const remoteVideo = document.getElementById('remote-video');
    const placeholder = document.getElementById('remote-placeholder');
    
    if (remoteVideo && placeholder) {
      if (data.enabled) {
        remoteVideo.style.display = 'block';
        placeholder.style.display = 'none';
      } else {
        remoteVideo.style.display = 'none';
        placeholder.style.display = 'flex';
        placeholder.innerHTML = '📹 Partner video off';
      }
    }
  }

  handleReportSubmitted(data) {
    this.showNotification(data.message, 'success');
  }

  handlePermissionError(err) {
    let message = 'Could not access camera or microphone.';
    
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      message = 'Camera/Microphone access denied. Please allow permissions in your browser settings.';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      message = 'No camera or microphone found. Please connect a device.';
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      message = 'Camera or microphone is busy. Please close other apps using them.';
    } else if (err.name === 'OverconstrainedError') {
      message = 'Camera does not support required settings. Try a different camera.';
    }
    
    this.showVideoModal(message, 'error');
    this.updateVideoStatus(message, 'error');
    this.permissionsGranted = false;
    
    // Hide modal after 5 seconds on error
    setTimeout(() => {
      this.hideVideoModal();
    }, 5000);
  }

  handlePeerError(err) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.showNotification(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'info');
      
      setTimeout(() => {
        if (this.inVideoChat) {
          this.createPeer(this.isInitiator);
        }
      }, 2000);
    } else {
      this.showNotification('Failed to reconnect. Please try again.', 'error');
      this.cleanupVideoChat(false);
      this.showReconnectModal('Connection failed');
    }
  }

  toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        this.audioEnabled = !this.audioEnabled;
        audioTrack.enabled = this.audioEnabled;
        
        // Notify partner
        this.socket.emit('video_toggle_audio', { enabled: this.audioEnabled });
        
        // Update UI
        const btn = document.getElementById('btn-toggle-audio');
        if (btn) {
          btn.innerHTML = this.audioEnabled ? '🔊' : '🔇';
          btn.classList.toggle('muted', !this.audioEnabled);
          btn.title = this.audioEnabled ? 'Mute Audio' : 'Unmute Audio';
        }
        
        // Show indicator
        const indicator = document.getElementById('self-audio-indicator');
        if (indicator) {
          if (this.audioEnabled) {
            indicator.innerHTML = '🎤';
            indicator.classList.remove('muted');
          } else {
            indicator.innerHTML = '🔇';
            indicator.classList.add('muted');
          }
        }
      }
    }
  }

  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        this.videoEnabled = !this.videoEnabled;
        videoTrack.enabled = this.videoEnabled;
        
        // Notify partner
        this.socket.emit('video_toggle_video', { enabled: this.videoEnabled });
        
        // Update UI
        const btn = document.getElementById('btn-toggle-video');
        if (btn) {
          btn.innerHTML = this.videoEnabled ? '📹' : '🚫';
          btn.classList.toggle('muted', !this.videoEnabled);
          btn.title = this.videoEnabled ? 'Stop Video' : 'Start Video';
        }
        
        // Hide/show local video
        const localVideo = document.getElementById('local-video');
        const localPlaceholder = document.getElementById('local-placeholder');
        
        if (localVideo && localPlaceholder) {
          if (this.videoEnabled) {
            localVideo.style.display = 'block';
            localPlaceholder.style.display = 'none';
          } else {
            localVideo.style.display = 'none';
            localPlaceholder.style.display = 'flex';
            localPlaceholder.innerHTML = '🚫 Video off';
          }
        }
      }
    }
  }

  skipPartner() {
    if (!this.inVideoChat) return;
    
    this.showNotification('Skipping to next partner...', 'info');
    this.socket.emit('video_skip');
    this.cleanupVideoChat(false);
    
    // Vibrate on mobile
    if (this.isMobile && navigator.vibrate) {
      navigator.vibrate(50);
    }
  }

  reportPartner(reason) {
    if (!this.inVideoChat) return;
    
    this.socket.emit('video_report', { reason });
    this.showNotification('Reporting partner...', 'info');
    this.cleanupVideoChat(false);
  }

  endVideoChat() {
    this.socket.emit('video_end');
    this.showNotification('Video chat ended', 'info');
    this.cleanupVideoChat(false);
  }

  cleanupVideoChat(stopLocalStream = false) {
    this.inVideoChat = false;
    this.partnerId = null;
    this.searchInProgress = false;
    
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    
    // Clear remote video
    const remoteVideo = document.getElementById('remote-video');
    if (remoteVideo) {
      remoteVideo.srcObject = null;
      remoteVideo.style.display = 'none';
    }
    
    const remotePlaceholder = document.getElementById('remote-placeholder');
    if (remotePlaceholder) {
      remotePlaceholder.style.display = 'flex';
      remotePlaceholder.innerHTML = '⏳ Ready to start new chat';
    }
    
    const remoteLoading = document.getElementById('remote-loading');
    if (remoteLoading) {
      remoteLoading.style.display = 'none';
    }
    
    // Stop local stream only when leaving video page
    if (stopLocalStream && this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      this.localStream = null;
      this.permissionsGranted = false;
    }
    
    // Hide controls
    document.getElementById('video-controls').style.display = 'none';
  }

  showVideoControls() {
    const modal = document.getElementById('video-permission-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    document.getElementById('video-controls').style.display = 'flex';
  }

  showVideoModal(message, type = 'info') {
    const modal = document.getElementById('video-permission-modal');
    const messageEl = document.getElementById('video-modal-message');
    
    if (modal && messageEl) {
      messageEl.textContent = message;
      messageEl.className = type;
      modal.style.display = 'flex';
      
      // Auto-hide after 8 seconds for searching state
      if (type === 'searching') {
        setTimeout(() => {
          if (this.searchInProgress && !this.inVideoChat) {
            modal.style.display = 'none';
          }
        }, 8000);
      }
    }
  }

  hideVideoModal() {
    const modal = document.getElementById('video-permission-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  showReconnectModal(message) {
    const modal = document.getElementById('video-reconnect-modal');
    const messageEl = document.getElementById('reconnect-message');
    
    if (modal && messageEl) {
      messageEl.textContent = message || 'Connection lost';
      modal.style.display = 'flex';
    }
  }

  hideReconnectModal() {
    const modal = document.getElementById('video-reconnect-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  updateVideoStatus(text, className) {
    const statusEl = document.getElementById('video-status');
    if (statusEl) {
      statusEl.textContent = text;
      statusEl.className = `video-status ${className}`;
    }
  }

  showNotification(message, type) {
    const notification = document.getElementById('video-notification');
    if (notification) {
      notification.textContent = message;
      notification.className = `video-notification ${type}`;
      notification.style.display = 'block';
      
      setTimeout(() => {
        notification.style.display = 'none';
      }, 3000);
    }
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OmegleVideoChat;
}