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
    try {
      // Request camera and microphone permissions
      const constraints = {
        video: videoEnabled ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false,
        audio: audioEnabled ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false
      };
      
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Display local video
      const localVideo = document.getElementById('local-video');
      if (localVideo) {
        localVideo.srcObject = this.localStream;
        localVideo.muted = true; // Mute local video to prevent echo
      }
      
      // Notify server that permissions are granted
      this.socket.emit('find_video_stranger');
      
      this.showVideoControls();
      this.updateVideoStatus('Searching for video partner...', 'searching');
      
      return true;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      this.handlePermissionError(err);
      return false;
    }
  }

  handlePermissionRequest() {
    this.showVideoModal('Requesting camera and microphone access...');
  }

  handleSearching(data) {
    this.updateVideoStatus(data.message, 'searching');
    this.showVideoModal(data.message);
  }

  handlePaired(data) {
    this.inVideoChat = true;
    this.isInitiator = data.initiator;
    this.partnerId = data.from;
    
    // Hide modal
    this.hideVideoModal();
    
    // Update UI
    this.updateVideoStatus('Connected!', 'connected');
    document.getElementById('video-controls').style.display = 'flex';
    document.getElementById('remote-video-container').style.display = 'block';
    
    // Create peer connection
    this.createPeer(this.isInitiator);
    
    // Show notification
    this.showNotification('Video partner connected!', 'success');
  }

  createPeer(isInitiator) {
    // Clean up existing peer
    if (this.peer) {
      this.peer.destroy();
    }
    
    const Peer = window.SimplePeer;
    
    this.peer = new Peer({
      initiator: isInitiator,
      stream: this.localStream,
      trickle: true,
      config: {
        iceServers: this.iceServers
      },
      sdpTransform: (sdp) => {
        // Force VP8 or H264 codec for better compatibility
        return sdp.replace(/VP9|H265/g, '');
      }
    });

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
      }
      
      // Hide loading indicator
      document.getElementById('remote-loading').style.display = 'none';
      
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
    this.showNotification('Stranger disconnected', 'error');
    this.updateVideoStatus('Stranger left', 'disconnected');
    this.cleanupVideoChat();
    
    // Show reconnect option
    this.showReconnectModal(data.message);
  }

  handleStrangerSkipped(data) {
    this.showNotification('Stranger skipped', 'info');
    this.updateVideoStatus('Stranger skipped', 'disconnected');
    this.cleanupVideoChat();
    
    // Auto search for new partner after 2 seconds
    setTimeout(() => {
      this.startVideoSearch();
    }, 2000);
  }

  handleVideoEnded(data) {
    this.showNotification(data.message, 'info');
    this.updateVideoStatus('Video chat ended', 'ended');
    this.cleanupVideoChat();
    this.hideVideoContainer();
  }

  handleReported(data) {
    this.showNotification(data.message, 'warning');
    this.cleanupVideoChat();
    this.hideVideoContainer();
  }

  handlePartnerToggleAudio(data) {
    const indicator = document.getElementById('partner-audio-indicator');
    if (indicator) {
      if (data.enabled) {
        indicator.classList.remove('muted');
        indicator.title = 'Partner audio on';
      } else {
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
      message = 'Camera/Microphone access denied. Please allow permissions and try again.';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      message = 'No camera or microphone found. Please connect a device.';
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      message = 'Camera or microphone is busy. Please close other apps using them.';
    }
    
    this.showVideoModal(message, 'error');
    this.updateVideoStatus(message, 'error');
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
      this.cleanupVideoChat();
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
          btn.innerHTML = this.audioEnabled ? '🔊 Audio' : '🔇 Audio';
          btn.classList.toggle('muted', !this.audioEnabled);
        }
        
        // Show indicator
        const indicator = document.getElementById('self-audio-indicator');
        if (indicator) {
          indicator.classList.toggle('muted', !this.audioEnabled);
          indicator.title = this.audioEnabled ? 'Audio on' : 'Audio off';
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
          btn.innerHTML = this.videoEnabled ? '📹 Video' : '🚫 Video';
          btn.classList.toggle('muted', !this.videoEnabled);
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
            localPlaceholder.innerHTML = '🚫 Your video off';
          }
        }
      }
    }
  }

  skipPartner() {
    this.showNotification('Skipping to next partner...', 'info');
    this.socket.emit('video_skip');
    this.cleanupVideoChat(false); // Don't stop local stream
  }

  reportPartner(reason) {
    this.socket.emit('video_report', { reason });
    this.showNotification('Reporting partner...', 'info');
    this.cleanupVideoChat();
  }

  endVideoChat() {
    this.socket.emit('video_end');
    this.showNotification('Video chat ended', 'info');
    this.cleanupVideoChat();
    this.hideVideoContainer();
  }

  startVideoSearch() {
    this.showVideoContainer();
    this.socket.emit('find_video_stranger');
  }

  cleanupVideoChat(stopLocalStream = true) {
    this.inVideoChat = false;
    this.partnerId = null;
    
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
    
    // Show remote placeholder
    const remotePlaceholder = document.getElementById('remote-placeholder');
    if (remotePlaceholder) {
      remotePlaceholder.style.display = 'flex';
      remotePlaceholder.innerHTML = '⏳ Waiting for partner...';
    }
    
    // Stop local stream if requested
    if (stopLocalStream && this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    // Hide controls
    document.getElementById('video-controls').style.display = 'none';
  }

  showVideoContainer() {
    document.getElementById('video-container').style.display = 'flex';
    document.getElementById('remote-loading').style.display = 'flex';
  }

  hideVideoContainer() {
    document.getElementById('video-container').style.display = 'none';
    this.cleanupVideoChat();
  }

  showVideoControls() {
    document.getElementById('video-permission-modal').style.display = 'none';
    document.getElementById('video-controls').style.display = 'flex';
  }

  showVideoModal(message, type = 'info') {
    const modal = document.getElementById('video-permission-modal');
    const messageEl = document.getElementById('video-modal-message');
    
    if (modal && messageEl) {
      messageEl.textContent = message;
      messageEl.className = type;
      modal.style.display = 'flex';
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