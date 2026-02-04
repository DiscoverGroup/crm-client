import React, { useState, useRef, useEffect } from 'react';

interface User {
  fullName: string;
  username: string;
  department?: string;
  position?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  placeholder = "Add comment...",
  style
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load all users from localStorage
  const getAllUsers = (): User[] => {
    const users = localStorage.getItem('crm_users');
    if (users) {
      return JSON.parse(users);
    }
    return [];
  };

  // Detect @ mentions and show suggestions
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const text = value;
    const cursorPos = textarea.selectionStart;
    
    // Find the last @ before cursor
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      
      // Check if there's a space after @, if yes, don't show suggestions
      if (textAfterAt.includes(' ') || textAfterAt.includes('\n')) {
        setShowSuggestions(false);
        return;
      }
      
      // Filter users based on search term
      const search = textAfterAt.toLowerCase();
      
      const allUsers = getAllUsers();
      
      // Create @everyone option
      const everyoneOption: User = {
        fullName: 'Everyone',
        username: 'everyone',
        department: 'All Users',
        position: 'Mention all users'
      };
      
      // Filter regular users
      const filteredUsers = allUsers.filter(user => 
        user.fullName.toLowerCase().includes(search) ||
        user.username.toLowerCase().includes(search)
      );
      
      // Add @everyone at the top if it matches the search
      let filtered = filteredUsers;
      if ('everyone'.includes(search) || search === '') {
        filtered = [everyoneOption, ...filteredUsers];
      }
      
      if (filtered.length > 0) {
        setSuggestions(filtered);
        setShowSuggestions(true);
        setSelectedIndex(0);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  }, [value, cursorPosition]);

  // Handle mention selection
  const insertMention = (user: User) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const text = value;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const beforeMention = text.substring(0, lastAtIndex);
      const afterCursor = text.substring(cursorPos);
      const mention = `@${user.username}`;
      const newText = beforeMention + mention + ' ' + afterCursor;
      
      onChange(newText);
      setShowSuggestions(false);
      
      // Set cursor position after the mention
      setTimeout(() => {
        if (textarea) {
          const newCursorPos = beforeMention.length + mention.length + 1;
          textarea.selectionStart = newCursorPos;
          textarea.selectionEnd = newCursorPos;
          textarea.focus();
        }
      }, 0);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Enter':
        if (showSuggestions && suggestions[selectedIndex]) {
          e.preventDefault();
          insertMention(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  // Track cursor position
  const handleSelectionChange = () => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', zIndex: 1, ...style }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onSelect={handleSelectionChange}
        onClick={handleSelectionChange}
        placeholder={placeholder}
        style={{
          width: '100%',
          minHeight: '60px',
          padding: '8px',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          fontSize: '13px',
          resize: 'vertical',
          outline: 'none',
          fontFamily: 'inherit'
        }}
      />
      
      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            backgroundColor: 'white',
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
            maxHeight: '200px',
            overflowY: 'auto',
            zIndex: 9999
          }}
        >
          {suggestions.map((user, index) => (
            <div
              key={user.username}
              onClick={() => insertMention(user)}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                backgroundColor: index === selectedIndex ? '#f0f9ff' : 'white',
                borderBottom: index < suggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: user.username === 'everyone' 
                    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: user.username === 'everyone' ? '14px' : '12px',
                  fontWeight: '600'
                }}>
                  {user.username === 'everyone' ? '👥' : user.fullName.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: '13px', 
                    fontWeight: user.username === 'everyone' ? '600' : '500',
                    color: user.username === 'everyone' ? '#d97706' : '#1e293b'
                  }}>
                    {user.fullName}
                  </div>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#64748b',
                    fontStyle: user.username === 'everyone' ? 'italic' : 'normal'
                  }}>
                    @{user.username}
                    {user.position && ` • ${user.position}`}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentionInput;
