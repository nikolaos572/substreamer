//
//  RNTPSafeCall.h
//  react-native-track-player
//
//  Defense-in-depth wrapper for TurboModule method bodies.
//
//  Background: facebook/react-native#50193 fixed NSException catching for
//  value-returning TurboModule methods on iOS, but void-returning methods
//  (which is what RNTP exposes) are still uncaught — any NSException raised
//  inside a void TurboModule method propagates to the bridge and crashes
//  the process with SIGABRT instead of becoming a JS rejection. Swift
//  do/catch only catches Error conformers, not NSException, so a Swift
//  `as!` cast failure inside the impl turns into a process kill.
//
//  This macro wraps a method body in @try/@catch (NSException *) and routes
//  any caught exception into the reject block. NSLog only — no crash
//  reporter integration.
//
//  Usage:
//    - (void)foo:(nonnull RCTPromiseResolveBlock)resolve reject:(nonnull RCTPromiseRejectBlock)reject {
//      RNTP_SAFE_CALL(reject, [nativeTrackPlayer fooWithResolve:resolve reject:reject]);
//    }
//

#ifndef RNTPSafeCall_h
#define RNTPSafeCall_h

#import <Foundation/Foundation.h>

#define RNTP_SAFE_CALL(__rntp_reject, ...) \
  do { \
    @try { \
      __VA_ARGS__; \
    } @catch (NSException *__rntp_exception) { \
      NSLog(@"[RNTP] NSException caught in TurboModule call: %@ — %@\n%@", \
            __rntp_exception.name, \
            __rntp_exception.reason ?: @"(no reason)", \
            __rntp_exception.callStackSymbols); \
      if (__rntp_reject) { \
        __rntp_reject(@"E_RNTP_NSEXCEPTION", \
                      [NSString stringWithFormat:@"%@: %@", \
                        __rntp_exception.name, \
                        __rntp_exception.reason ?: @"(no reason)"], \
                      nil); \
      } \
    } \
  } while (0)

#endif /* RNTPSafeCall_h */
