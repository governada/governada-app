#include <Security/Security.h>
#include <errno.h>
#include <limits.h>
#include <mach-o/dyld.h>
#include <pwd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

extern char **environ;

#ifndef GOVERNADA_HELPER_PATH
#error "GOVERNADA_HELPER_PATH is required"
#endif

#ifndef GOVERNADA_BROKER_SCRIPT_PATH
#error "GOVERNADA_BROKER_SCRIPT_PATH is required"
#endif

static void fail(const char *message, int code) {
  fprintf(stderr, "%s\n", message);
  exit(code);
}

static void fail_status(OSStatus status) {
  CFStringRef message = SecCopyErrorMessageString(status, NULL);
  if (message) {
    char buffer[512];
    if (CFStringGetCString(message, buffer, sizeof(buffer), kCFStringEncodingUTF8)) {
      fprintf(stderr, "%d: %s\n", (int)status, buffer);
    } else {
      fprintf(stderr, "%d\n", (int)status);
    }
    CFRelease(message);
  } else {
    fprintf(stderr, "%d\n", (int)status);
  }
  exit(1);
}

static char *read_stdin_token(void) {
  size_t capacity = 4096;
  size_t length = 0;
  char *buffer = malloc(capacity);
  if (!buffer) {
    fail("could not allocate stdin buffer", 70);
  }

  int ch;
  while ((ch = fgetc(stdin)) != EOF) {
    if (length + 1 >= capacity) {
      capacity *= 2;
      char *resized = realloc(buffer, capacity);
      if (!resized) {
        free(buffer);
        fail("could not resize stdin buffer", 70);
      }
      buffer = resized;
    }
    buffer[length++] = (char)ch;
  }

  while (length > 0 && (buffer[length - 1] == '\n' || buffer[length - 1] == '\r')) {
    length--;
  }
  buffer[length] = '\0';

  if (length == 0) {
    free(buffer);
    fail("refusing to cache an empty token", 65);
  }

  return buffer;
}

static SecKeychainRef copy_default_keychain(void) {
  SecKeychainRef keychain = NULL;
  OSStatus status = SecKeychainCopyDefault(&keychain);
  if (status != errSecSuccess) {
    fail_status(status);
  }
  if (!keychain) {
    fail("default keychain was unavailable", 70);
  }
  return keychain;
}

static void read_keychain_password(SecKeychainRef keychain, const char *service,
                                   UInt32 service_len, const char *account,
                                   UInt32 account_len, UInt32 *password_len,
                                   void **password) {
  SecKeychainItemRef item = NULL;
  OSStatus status = SecKeychainFindGenericPassword(
      keychain, service_len, service, account_len, account, password_len, password, &item);
  if (item) {
    CFRelease(item);
  }
  if (status == errSecItemNotFound) {
    fail("keychain item not found", 44);
  }
  if (status != errSecSuccess) {
    fail_status(status);
  }
  if (!*password || *password_len == 0) {
    if (*password) {
      SecKeychainItemFreeContent(NULL, *password);
    }
    fail("keychain item did not contain token data", 65);
  }
}

static char *env_entry(const char *key, const char *value) {
  size_t key_len = strlen(key);
  size_t value_len = strlen(value);
  char *entry = malloc(key_len + value_len + 2);
  if (!entry) {
    fail("could not allocate child environment entry", 70);
  }
  memcpy(entry, key, key_len);
  entry[key_len] = '=';
  memcpy(entry + key_len + 1, value, value_len);
  entry[key_len + value_len + 1] = '\0';
  return entry;
}

static void append_env_entry(char **child_env, size_t capacity, size_t *index, const char *key,
                             const char *value) {
  if (!value || value[0] == '\0') {
    return;
  }
  if (*index + 1 >= capacity) {
    fail("child environment capacity exceeded", 70);
  }
  child_env[*index] = env_entry(key, value);
  (*index)++;
}

static const char *env_value(const char *key) {
  for (size_t env_index = 0; environ[env_index]; env_index++) {
    size_t key_len = strlen(key);
    if (strncmp(environ[env_index], key, key_len) == 0 && environ[env_index][key_len] == '=') {
      return environ[env_index] + key_len + 1;
    }
  }
  return NULL;
}

static const char *safe_home_dir(void) {
  struct passwd *pw = getpwuid(getuid());
  if (pw && pw->pw_dir && pw->pw_dir[0] != '\0') {
    return pw->pw_dir;
  }
  return env_value("HOME");
}

static char *secret_env_entry(const char *key, const void *password, UInt32 password_len) {
  size_t key_len = strlen(key);
  char *entry = malloc(key_len + password_len + 2);
  if (!entry) {
    fail("could not allocate token environment entry", 70);
  }
  memcpy(entry, key, key_len);
  entry[key_len] = '=';
  memcpy(entry + key_len + 1, password, password_len);
  entry[key_len + password_len + 1] = '\0';
  return entry;
}

static char **environment_with_broker_token(const void *password, UInt32 password_len) {
  const size_t capacity = 24;
  char **child_env = calloc(capacity, sizeof(char *));
  if (!child_env) {
    fail("could not allocate child environment", 70);
  }

  size_t index = 0;
  append_env_entry(child_env, capacity, &index, "PATH",
                   "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin");
  append_env_entry(child_env, capacity, &index, "HOME", safe_home_dir());
  append_env_entry(child_env, capacity, &index, "USER", env_value("USER"));
  append_env_entry(child_env, capacity, &index, "LOGNAME", env_value("LOGNAME"));
  append_env_entry(child_env, capacity, &index, "LANG", env_value("LANG"));
  append_env_entry(child_env, capacity, &index, "LC_ALL", env_value("LC_ALL"));
  append_env_entry(child_env, capacity, &index, "GOVERNADA_GITHUB_APP_ID",
                   env_value("GOVERNADA_GITHUB_APP_ID"));
  append_env_entry(child_env, capacity, &index, "GOVERNADA_GITHUB_APP_INSTALLATION_ID",
                   env_value("GOVERNADA_GITHUB_APP_INSTALLATION_ID"));
  append_env_entry(child_env, capacity, &index, "GOVERNADA_GITHUB_APP_PRIVATE_KEY_OP_REF",
                   env_value("GOVERNADA_GITHUB_APP_PRIVATE_KEY_OP_REF"));
  append_env_entry(child_env, capacity, &index, "GOVERNADA_OP_SERVICE_ACCOUNT_EXPIRES_AT",
                   env_value("GOVERNADA_OP_SERVICE_ACCOUNT_EXPIRES_AT"));
  append_env_entry(child_env, capacity, &index, "GOVERNADA_OP_SERVICE_ACCOUNT_ROTATE_AFTER",
                   env_value("GOVERNADA_OP_SERVICE_ACCOUNT_ROTATE_AFTER"));
  child_env[index++] = secret_env_entry("OP_SERVICE_ACCOUNT_TOKEN", password, password_len);
  child_env[index] = NULL;
  return child_env;
}

static char **environment_with_github_token(const void *password, UInt32 password_len) {
  const size_t capacity = 16;
  char **child_env = calloc(capacity, sizeof(char *));
  if (!child_env) {
    fail("could not allocate child environment", 70);
  }

  size_t index = 0;
  append_env_entry(child_env, capacity, &index, "PATH",
                   "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin");
  append_env_entry(child_env, capacity, &index, "HOME", safe_home_dir());
  append_env_entry(child_env, capacity, &index, "USER", env_value("USER"));
  append_env_entry(child_env, capacity, &index, "LOGNAME", env_value("LOGNAME"));
  append_env_entry(child_env, capacity, &index, "LANG", env_value("LANG"));
  append_env_entry(child_env, capacity, &index, "LC_ALL", env_value("LC_ALL"));
  append_env_entry(child_env, capacity, &index, "GH_CONFIG_DIR", env_value("GH_CONFIG_DIR"));
  append_env_entry(child_env, capacity, &index, "GH_HOST", env_value("GH_HOST"));
  append_env_entry(child_env, capacity, &index, "GH_REPO", env_value("GH_REPO"));
  child_env[index++] = secret_env_entry("GH_TOKEN", password, password_len);
  child_env[index] = NULL;
  return child_env;
}

static char *current_executable_realpath(void) {
  uint32_t size = 0;
  _NSGetExecutablePath(NULL, &size);
  char *raw_path = malloc(size + 1);
  if (!raw_path) {
    fail("could not allocate executable path", 70);
  }
  if (_NSGetExecutablePath(raw_path, &size) != 0) {
    free(raw_path);
    fail("could not resolve executable path", 70);
  }

  char resolved_path[PATH_MAX];
  if (!realpath(raw_path, resolved_path)) {
    free(raw_path);
    fail("could not canonicalize executable path", 70);
  }
  free(raw_path);

  char *result = strdup(resolved_path);
  if (!result) {
    fail("could not allocate executable path", 70);
  }
  return result;
}

static void validate_helper_location(void) {
  char expected_path[PATH_MAX];
  if (!realpath(GOVERNADA_HELPER_PATH, expected_path)) {
    fail("expected Keychain helper path is not available", 70);
  }

  char *actual_path = current_executable_realpath();
  int matches = strcmp(actual_path, expected_path) == 0;
  free(actual_path);
  if (!matches) {
    fail("Keychain helper path does not match compiled Governada helper path", 70);
  }
}

static char *broker_script_from_compiled_path(void) {
  char resolved_path[PATH_MAX];
  if (!realpath(GOVERNADA_BROKER_SCRIPT_PATH, resolved_path)) {
    fail("expected broker script is not readable", 70);
  }

  char *broker_script = strdup(resolved_path);
  if (!broker_script) {
    fail("could not allocate broker script path", 70);
  }
  return broker_script;
}

static const char *find_node_path(void) {
  const char *candidates[] = {
      "/opt/homebrew/bin/node",
      "/usr/local/bin/node",
      "/usr/bin/node",
      NULL,
  };

  for (int index = 0; candidates[index]; index++) {
    if (access(candidates[index], X_OK) == 0) {
      return candidates[index];
    }
  }

  fail("allowlisted Node executable was not found", 70);
  return NULL;
}

static const char *find_gh_path(void) {
  const char *candidates[] = {
      "/opt/homebrew/bin/gh",
      "/usr/local/bin/gh",
      "/usr/bin/gh",
      NULL,
  };

  for (int index = 0; candidates[index]; index++) {
    if (access(candidates[index], X_OK) == 0) {
      return candidates[index];
    }
  }

  fail("allowlisted GitHub CLI executable was not found", 70);
  return NULL;
}

int main(int argc, char **argv) {
  if (argc < 4) {
    fail("usage: github-keychain-cache <write|run-broker|run-gh> <account> <service> [args...]",
         64);
  }

  const char *command = argv[1];
  const char *account = argv[2];
  const char *service = argv[3];
  UInt32 account_len = (UInt32)strlen(account);
  UInt32 service_len = (UInt32)strlen(service);
  validate_helper_location();
  SecKeychainRef keychain = copy_default_keychain();

  if (strcmp(command, "run-broker") == 0) {
    if (argc != 4) {
      fail("usage: github-keychain-cache run-broker <account> <service>", 64);
    }

    UInt32 password_len = 0;
    void *password = NULL;
    read_keychain_password(keychain, service, service_len, account, account_len, &password_len,
                           &password);
    char **child_env = environment_with_broker_token(password, password_len);
    const char *node_path = find_node_path();
    char *broker_script = broker_script_from_compiled_path();
    char *child_argv[] = {(char *)node_path, broker_script, NULL};
    SecKeychainItemFreeContent(NULL, password);
    CFRelease(keychain);
    execve(node_path, child_argv, child_env);
    fprintf(stderr, "execve failed: %s\n", strerror(errno));
    return 70;
  }

  if (strcmp(command, "run-gh") == 0) {
    if (argc < 5) {
      fail("usage: github-keychain-cache run-gh <account> <service> <gh-args...>", 64);
    }

    UInt32 password_len = 0;
    void *password = NULL;
    read_keychain_password(keychain, service, service_len, account, account_len, &password_len,
                           &password);
    char **child_env = environment_with_github_token(password, password_len);
    const char *gh_path = find_gh_path();
    char **child_argv = calloc((size_t)argc - 2, sizeof(char *));
    if (!child_argv) {
      SecKeychainItemFreeContent(NULL, password);
      CFRelease(keychain);
      fail("could not allocate gh child argv", 70);
    }
    child_argv[0] = (char *)gh_path;
    for (int index = 4; index < argc; index++) {
      child_argv[index - 3] = argv[index];
    }
    child_argv[argc - 3] = NULL;
    SecKeychainItemFreeContent(NULL, password);
    CFRelease(keychain);
    execve(gh_path, child_argv, child_env);
    fprintf(stderr, "execve failed: %s\n", strerror(errno));
    return 70;
  }

  if (strcmp(command, "write") == 0) {
    if (argc != 6) {
      fail("usage: github-keychain-cache write <account> <service> <label> <comment>", 64);
    }

    const char *label = argv[4];
    const char *comment = argv[5];
    (void)label;
    (void)comment;
    char *token = read_stdin_token();

    SecKeychainItemRef item = NULL;
    OSStatus find_status = SecKeychainFindGenericPassword(
        keychain, service_len, service, account_len, account, NULL, NULL, &item);
    if (find_status == errSecSuccess && item) {
      OSStatus update_status =
          SecKeychainItemModifyAttributesAndData(item, NULL, (UInt32)strlen(token), token);
      CFRelease(item);
      free(token);
      CFRelease(keychain);
      if (update_status == errSecSuccess) {
        return 0;
      }
      fail_status(update_status);
    }

    if (item) {
      CFRelease(item);
    }
    if (find_status != errSecItemNotFound) {
      free(token);
      CFRelease(keychain);
      fail_status(find_status);
    }

    OSStatus add_status = SecKeychainAddGenericPassword(
        keychain, service_len, service, account_len, account, (UInt32)strlen(token), token, NULL);
    free(token);
    CFRelease(keychain);
    if (add_status == errSecSuccess) {
      return 0;
    }
    fail_status(add_status);
  }

  CFRelease(keychain);
  fail("unknown command", 64);
}
