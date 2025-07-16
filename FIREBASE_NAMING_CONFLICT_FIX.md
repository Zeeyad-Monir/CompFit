# Firebase Naming Conflict Fix

## Problem
There was a naming conflict in `src/firebase.js` where a custom function called `getAuth` was colliding with Firebase's imported `getAuth` from `'firebase/auth'`.

```javascript
// CONFLICT: Both of these existed in the same file
import { getAuth } from 'firebase/auth';           // Firebase's getAuth
export function getAuth() { ... }                 // Custom getAuth function
```

This could cause:
- Unexpected behavior when calling `getAuth()`
- JavaScript engine confusion about which function to call
- Potential runtime errors or incorrect Firebase initialization

## Solution
Renamed the imported Firebase function and the custom function to avoid conflicts:

### Changes Made:

1. **Renamed Firebase Import**: Changed the import to use an alias
   ```javascript
   // Before
   import { getAuth } from 'firebase/auth';
   
   // After
   import { getAuth as firebaseGetAuth } from 'firebase/auth';
   ```

2. **Updated Internal Usage**: Updated the internal function to use the renamed import
   ```javascript
   // Before
   _auth = getAuth(app);
   
   // After  
   _auth = firebaseGetAuth(app);
   ```

3. **Renamed Custom Functions**: Renamed the custom exported functions to be more descriptive
   ```javascript
   // Before
   export function getAuth() { ... }
   export function getDb() { ... }
   
   // After
   export function getLazyAuth() { ... }
   export function getLazyDb() { ... }
   ```

## Files Modified
- `src/firebase.js` - Fixed naming conflicts and improved function names

## Function Mapping
| Original Function | New Function | Purpose |
|------------------|--------------|---------|
| `getAuth` (Firebase) | `firebaseGetAuth` | Firebase's auth instance creator |
| `getAuth` (custom) | `getLazyAuth` | Custom lazy auth getter |
| `getDb` (custom) | `getLazyDb` | Custom lazy db getter |

## Internal Function Structure
The internal structure remains unchanged:
- `getAuthInstance()` - Internal function that creates and caches auth instance
- `getDbInstance()` - Internal function that creates and caches db instance
- `initializeFirebaseApp()` - Internal function that initializes Firebase app

## Backward Compatibility
The legacy proxy exports (`auth` and `db`) are maintained for backward compatibility:
```javascript
export const auth = new Proxy({}, { ... });  // Still works
export const db = new Proxy({}, { ... });    // Still works
```

## Verification
- ✅ No naming conflicts between imports and exports
- ✅ All internal references use correct function names
- ✅ Firebase auth initialization uses `firebaseGetAuth(app)`
- ✅ Custom lazy functions have descriptive names
- ✅ Backward compatibility maintained through proxy exports
- ✅ App builds successfully without syntax errors

## Impact
This fix ensures that:
1. Firebase's `getAuth` function is correctly imported and used
2. Custom lazy initialization functions have clear, non-conflicting names
3. No runtime errors occur due to function name ambiguity
4. The lazy initialization pattern continues to work as expected
5. Existing code that imports `auth` and `db` continues to work unchanged

## Testing
The fix was verified by:
1. Checking all function references in the file
2. Confirming no external imports of the custom functions
3. Verifying the app builds without errors
4. Ensuring backward compatibility through proxy exports